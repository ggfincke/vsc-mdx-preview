// packages/extension/preview/preview-manager.ts
// * preview manager & preview instances w/ stale detection & custom CSS support

import * as vscode from 'vscode';
import * as fs from 'fs';
import { TextDecoder } from 'util';
import {
  performance,
  PerformanceObserver,
  PerformanceObserverEntryList,
} from 'perf_hooks';
import { error as logError, debug } from '../logging';

import { createOrShowPanel, refreshPanel } from './webview-manager';
import evaluateInWebview from './evaluate-in-webview';
import { disposeConfigWatchers, type ResolvedConfig } from './config';
import { WatcherManager, DocumentTracker } from './watchers';

// extracted modules
import {
  PreviewConfiguration,
  type UpdateMode,
  type StyleConfiguration,
  type ConfigurationState,
} from './PreviewConfiguration';
import {
  PreviewWebviewBridge,
  type WebviewHandle,
} from './PreviewWebviewBridge';
import { PreviewDocumentHandler } from './PreviewDocumentHandler';
import { PreviewInitializer } from './PreviewInitializer';

// re-export types for backward compatibility
export type { UpdateMode, StyleConfiguration, WebviewHandle };
export type { TypeScriptConfiguration } from './config';

// * preview manager singleton for managing all preview instances
export class PreviewManager {
  private static instance: PreviewManager;
  private currentPreview: Preview | undefined;
  private subscribers: Set<() => void> = new Set();

  private constructor() {}

  static getInstance(): PreviewManager {
    if (!PreviewManager.instance) {
      PreviewManager.instance = new PreviewManager();
    }
    return PreviewManager.instance;
  }

  // static dispose for singleton cleanup
  static dispose(): void {
    if (PreviewManager.instance) {
      PreviewManager.instance.dispose();
      // @ts-expect-error reset singleton for dispose
      PreviewManager.instance = undefined;
    }
  }

  // get current preview
  getCurrentPreview(): Preview | undefined {
    return this.currentPreview;
  }

  // set current preview & notify subscribers
  setCurrentPreview(preview: Preview | undefined): void {
    this.currentPreview = preview;
    this.notifySubscribers();
  }

  // refresh all active previews (e.g., when trust state changes)
  refreshAllPreviews(): void {
    if (this.currentPreview?.active) {
      this.currentPreview.refreshWebview();
    }
  }

  // push theme to all active previews without full refresh
  pushThemeToAllPreviews(): void {
    if (this.currentPreview?.active) {
      this.currentPreview.pushThemeState();
    }
  }

  // check if there are any active previews
  hasActivePreviews(): boolean {
    return this.currentPreview?.active ?? false;
  }

  // subscribe to preview state changes (open/close)
  subscribe(callback: () => void): vscode.Disposable {
    this.subscribers.add(callback);
    return {
      dispose: () => {
        this.subscribers.delete(callback);
      },
    };
  }

  // notify subscribers when preview state changes
  private notifySubscribers(): void {
    for (const callback of this.subscribers) {
      callback();
    }
  }

  // dispose current preview & cleanup
  private dispose(): void {
    this.currentPreview?.dispose();
    this.currentPreview = undefined;
    this.subscribers.clear();
  }
}

// get current preview through manager (backward compatibility)
export function getCurrentPreview(): Preview | undefined {
  return PreviewManager.getInstance().getCurrentPreview();
}

export class Preview {
  active = false;
  private _webview?: vscode.Webview;
  private tailwindRequestId = 0;

  get webview(): vscode.Webview | undefined {
    return this._webview;
  }

  set webview(value: vscode.Webview | undefined) {
    this._webview = value;
    if (value) {
      this.webviewBridge.setWebview(value);
    }
  }

  // composed modules
  private configManager: PreviewConfiguration;
  private webviewBridge: PreviewWebviewBridge;
  private documentHandler: PreviewDocumentHandler;
  private initializer: PreviewInitializer;

  // watcher manager for coordinated lifecycle management
  private watcherManager: WatcherManager;

  // handshake state
  webviewHandshakePromise!: Promise<void>;
  private resolveWebviewHandshakePromise!: () => void;

  // performance tracking
  performanceObserver?: PerformanceObserver;
  evaluationDuration = 0;
  previewDuration = 0;

  // delegate getters to composed modules
  get doc(): vscode.TextDocument {
    return this.documentHandler.doc;
  }

  get editingDoc(): vscode.TextDocument | undefined {
    return this.documentHandler.editingDoc;
  }

  get dependentFsPaths(): Set<string> {
    return this.documentHandler.dependentFsPaths;
  }

  get fsPath(): string {
    return this.documentHandler.fsPath;
  }

  get text(): string {
    return this.documentHandler.text;
  }

  get entryFsDirectory(): string | null {
    return this.documentHandler.entryFsDirectory;
  }

  get typescriptConfiguration() {
    return this.documentHandler.typescriptConfiguration;
  }

  get mdxPreviewConfig(): ResolvedConfig | undefined {
    return this.documentHandler.mdxPreviewConfig;
  }

  get configuration(): ConfigurationState {
    return this.configManager.configuration;
  }

  get styleConfiguration(): StyleConfiguration {
    return this.configManager.styleConfiguration;
  }

  get securityConfiguration() {
    return this.configManager.securityConfiguration;
  }

  get webviewHandle(): WebviewHandle {
    return this.webviewBridge.getHandle()!;
  }

  constructor(doc: vscode.TextDocument) {
    debug('[PREVIEW] Preview constructor called');

    // initialize composed modules
    this.initializer = new PreviewInitializer();
    this.documentHandler = new PreviewDocumentHandler();
    this.webviewBridge = new PreviewWebviewBridge();
    this.configManager = new PreviewConfiguration(doc.uri, () =>
      this.updateWebview()
    );

    // initialize handshake
    const handshake = this.initializer.createHandshake();
    this.webviewHandshakePromise = handshake.promise;
    this.resolveWebviewHandshakePromise = handshake.resolve;

    // initialize watchers
    this.watcherManager = this.initializer.initializeWatchers(
      this.configManager.configuration.customCss,
      async (fsPath) => {
        await this.webviewBridge.invalidate(fsPath);
        await this.updateWebview(true);
      }
    );

    // set document
    this.setDoc(doc);

    // setup performance observer in development
    if (process.env.NODE_ENV === 'development') {
      this.performanceObserver = new PerformanceObserver(
        (list: PerformanceObserverEntryList) => {
          this.previewDuration = list.getEntries()[0].duration;
          vscode.window.showInformationMessage(
            `Previewing used: ${Number(this.previewDuration / 1000).toFixed(2)} seconds. ` +
              `Evaluation used: ${Number(this.evaluationDuration / 1000).toFixed(2)} seconds.`
          );
          performance.clearMarks();
        }
      );
      this.performanceObserver.observe({ entryTypes: ['measure'] });
    }
  }

  initWebviewHandshakePromise(): void {
    const handshake = this.initializer.createHandshake();
    this.webviewHandshakePromise = handshake.promise;
    this.resolveWebviewHandshakePromise = handshake.resolve;
  }

  setDoc(doc: vscode.TextDocument): void {
    const { needsConfigWatcher } = this.documentHandler.setDoc(
      doc,
      this.watcherManager
    );
    if (needsConfigWatcher) {
      this.setupConfigWatcher();
    }
  }

  private setupConfigWatcher(): void {
    this.initializer.setupConfigWatcher(
      this.watcherManager,
      this.documentHandler.mdxPreviewConfig,
      this.documentHandler.fsPath,
      () => {
        this.documentHandler.reloadMdxConfig();
        this.refreshWebview().catch((err) =>
          logError('Failed to refresh after config change', err)
        );
      }
    );
  }

  updateTailwindWatchFiles(watchFiles: string[]): void {
    this.initializer.setupTailwindConfigWatcher(
      this.watcherManager,
      watchFiles,
      () => {
        this.updateWebview(true).catch((err) =>
          logError('Failed to refresh after Tailwind change', err)
        );
      }
    );
  }

  nextTailwindRequestId(): number {
    this.tailwindRequestId += 1;
    return this.tailwindRequestId;
  }

  isTailwindRequestCurrent(requestId: number): boolean {
    return requestId === this.tailwindRequestId;
  }

  resetRenderedVersion(): void {
    this.documentHandler.resetRenderedVersion(this.watcherManager);
  }

  getWebviewUri(fsPath: string): string | undefined {
    return this.webviewBridge.getWebviewUri(fsPath);
  }

  setWebviewHandle(handle: WebviewHandle): void {
    this.webviewBridge.setWebviewHandle(handle, this.watcherManager);
  }

  onWebviewReady(): void {
    this.webviewBridge.onWebviewReady(this.doc.uri);
  }

  pushThemeState(frontmatter?: Record<string, unknown>): void {
    this.webviewBridge.pushThemeState(this.doc.uri, frontmatter);
  }

  markStale(): void {
    this.documentHandler.markStale(this.watcherManager);
  }

  updateDependencies(imports: string[]): void {
    this.documentHandler.updateDependencies(imports, this.watcherManager);
  }

  async updateWebview(force = false): Promise<void> {
    debug('[PREVIEW] updateWebview called');
    const { uri } = this.doc;
    const { scheme, fsPath } = uri;
    debug(`[PREVIEW] updateWebview scheme=${scheme}, fsPath=${fsPath}`);

    const currentVersion = this.doc.version;
    const docTracker = this.watcherManager.get<DocumentTracker>('document');

    // skip if we've already rendered this version (unless forced)
    if (!force && docTracker?.hasRenderedVersion(currentVersion)) {
      debug('[PREVIEW] Skipping update - same version');
      return;
    }

    switch (scheme) {
      case 'untitled': {
        debug('[PREVIEW] updateWebview: untitled scheme');
        await evaluateInWebview(this, this.text, this.entryFsDirectory ?? '');
        break;
      }
      case 'file': {
        debug('[PREVIEW] updateWebview: file scheme');
        if (this.configuration.updateMode === 'onType') {
          await evaluateInWebview(this, this.text, fsPath);
        } else {
          const text = await fs.promises.readFile(fsPath, { encoding: 'utf8' });
          await evaluateInWebview(this, text, fsPath);
        }
        break;
      }
      default: {
        debug(`[PREVIEW] updateWebview: default scheme (${scheme})`);
        let text = this.text;
        if (this.configuration.updateMode !== 'onType') {
          try {
            const bytes = await vscode.workspace.fs.readFile(uri);
            text = new TextDecoder().decode(bytes);
          } catch {
            text = this.text;
          }
        }
        await evaluateInWebview(this, text, fsPath);
        break;
      }
    }

    // update tracking after successful render
    docTracker?.markRendered(currentVersion);
  }

  async refreshWebview(): Promise<void> {
    debug('[PREVIEW] refreshWebview called');
    const currentPreview = PreviewManager.getInstance().getCurrentPreview();
    if (currentPreview) {
      refreshPanel(currentPreview);
      await this.updateWebview(true);
    }
  }

  async handleDidChangeTextDocument(
    fsPath: string,
    doc: vscode.TextDocument
  ): Promise<void> {
    await this.documentHandler.handleDidChangeTextDocument(
      fsPath,
      doc,
      this.active,
      this.configuration.updateMode,
      () => this.markStale(),
      (path) => this.webviewBridge.invalidate(path),
      () => this.configManager.debouncedUpdateWebview()
    );
  }

  async handleDidSaveTextDocument(fsPath: string): Promise<void> {
    await this.documentHandler.handleDidSaveTextDocument(
      fsPath,
      this.active,
      this.configuration.updateMode,
      () => this.markStale(),
      (path) => this.webviewBridge.invalidate(path),
      () => this.updateWebview()
    );
  }

  updateConfiguration(): void {
    const result = this.configManager.updateConfiguration(this.doc.uri, () =>
      this.updateWebview()
    );

    if (result.needsCssWatcherUpdate) {
      this.initializer.setupCustomCssWatcher(
        this.watcherManager,
        this.configuration.customCss,
        this.entryFsDirectory,
        this.webviewBridge.getHandle()
      );
    }

    if (result.needsWebviewRefresh) {
      this.refreshWebview().catch((err) =>
        logError('Failed to refresh preview', err)
      );
    }
  }

  // dispose of resources held by this preview
  dispose(): void {
    this.watcherManager.dispose();
  }
}

// dispose all config watchers (call during extension deactivation)
export { disposeConfigWatchers };

export async function openPreview(): Promise<void> {
  debug('[PREVIEW] openPreview called');
  if (!vscode.window.activeTextEditor) {
    debug('[PREVIEW] No active text editor, aborting');
    return;
  }
  const doc = vscode.window.activeTextEditor.document;
  debug(`[PREVIEW] Opening preview for: ${doc.uri.fsPath}`);
  const manager = PreviewManager.getInstance();
  let currentPreview = manager.getCurrentPreview();

  if (!currentPreview) {
    debug('[PREVIEW] Creating new Preview instance');
    currentPreview = new Preview(doc);
    manager.setCurrentPreview(currentPreview);
  } else {
    debug('[PREVIEW] Reusing existing Preview instance');
    currentPreview.setDoc(doc);
  }
  debug('[PREVIEW] Calling createOrShowPanel');
  createOrShowPanel(currentPreview);
  debug('[PREVIEW] Calling updateWebview');
  await currentPreview.updateWebview();
  debug('[PREVIEW] openPreview complete');
}

export async function refreshPreview(): Promise<void> {
  debug('[PREVIEW] refreshPreview called');
  const currentPreview = PreviewManager.getInstance().getCurrentPreview();
  if (!currentPreview) {
    debug('[PREVIEW] No current preview, aborting refresh');
    return;
  }
  refreshPanel(currentPreview);
  await currentPreview.updateWebview(true);
  debug('[PREVIEW] refreshPreview complete');
}
