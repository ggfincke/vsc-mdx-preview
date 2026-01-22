// packages/extension/preview/preview-manager.ts
// * preview manager & preview instances w/ stale detection & custom CSS support

import * as vscode from 'vscode';
import { error as logError, debug } from '../logging';
import { SingletonService } from '../services/SingletonService';
import { SubscriberManager } from '../utils/SubscriberManager';

import { createOrShowPanel, refreshPanel } from './webview-manager';
import {
  disposeConfigWatchers,
  type ResolvedConfig,
  type TypeScriptConfiguration,
} from './config';
import { WatcherManager } from './watchers';

// extracted components for Preview class
import { PreviewState } from './PreviewState';
import { PreviewEvaluator } from './PreviewEvaluator';

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

// webview app URIs (loaded from Vite manifest)
export interface WebviewAppUris {
  mainScript: vscode.Uri;
  mainStyle: vscode.Uri | undefined;
}

// * preview manager singleton for managing all preview instances
export class PreviewManager extends SingletonService<PreviewManager> {
  protected static override instance: PreviewManager | undefined;
  protected readonly logTag = 'PREVIEW-MANAGER';

  private currentPreview: Preview | undefined;
  private subscriberManager = new SubscriberManager<void>('PREVIEW-MANAGER');

  // panel state (moved from webview-manager.ts module-level for better testability)
  private _panel: vscode.WebviewPanel | undefined;
  private _panelDoc: vscode.TextDocument | undefined;
  private _panelDisposables: vscode.Disposable[] = [];

  // webview URI state (moved from webview-manager.ts for lifecycle management)
  private _webviewAppUris: WebviewAppUris | undefined;
  private _extensionUri: vscode.Uri | undefined;

  protected constructor() {
    super();
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
    return this.subscriberManager.subscribe(callback);
  }

  // panel state accessors
  getPanel(): vscode.WebviewPanel | undefined {
    return this._panel;
  }

  setPanel(panel: vscode.WebviewPanel | undefined): void {
    this._panel = panel;
  }

  getPanelDoc(): vscode.TextDocument | undefined {
    return this._panelDoc;
  }

  setPanelDoc(doc: vscode.TextDocument | undefined): void {
    this._panelDoc = doc;
  }

  getPanelDisposables(): vscode.Disposable[] {
    return this._panelDisposables;
  }

  // webview URI state accessors
  getWebviewAppUris(): WebviewAppUris | undefined {
    return this._webviewAppUris;
  }

  setWebviewAppUris(uris: WebviewAppUris): void {
    this._webviewAppUris = uris;
  }

  getExtensionUri(): vscode.Uri | undefined {
    return this._extensionUri;
  }

  setExtensionUri(uri: vscode.Uri): void {
    this._extensionUri = uri;
  }

  // clear panel state (called when panel is disposed)
  clearPanel(): void {
    this._panel?.dispose();
    while (this._panelDisposables.length) {
      const disposable = this._panelDisposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
    this._panel = undefined;
    this._panelDoc = undefined;
  }

  // notify subscribers when preview state changes
  private notifySubscribers(): void {
    this.subscriberManager.notify(undefined);
  }

  // custom cleanup - clear panel, preview, & subscribers
  protected override onDispose(): void {
    this.clearPanel();
    this.currentPreview?.dispose();
    this.currentPreview = undefined;
    this.subscriberManager.clear();
  }
}

// get current preview through manager (backward compatibility)
export function getCurrentPreview(): Preview | undefined {
  return PreviewManager.getInstance().getCurrentPreview();
}

export class Preview {
  active = false;
  private _webview?: vscode.Webview;

  get webview(): vscode.Webview | undefined {
    return this._webview;
  }

  set webview(value: vscode.Webview | undefined) {
    this._webview = value;
    if (value) {
      this.webviewBridge.setWebview(value);
    }
  }

  // composed modules (existing)
  private configManager: PreviewConfiguration;
  private webviewBridge: PreviewWebviewBridge;
  private documentHandler: PreviewDocumentHandler;
  private initializer: PreviewInitializer;

  // watcher manager for coordinated lifecycle management
  private watcherManager: WatcherManager;

  // extracted components (new)
  private state: PreviewState;
  private evaluator!: PreviewEvaluator;

  // handshake state
  webviewHandshakePromise!: Promise<void>;
  private resolveWebviewHandshakePromise!: () => void;

  // public method for RPC handle to complete handshake
  completeHandshake(): void {
    this.resolveWebviewHandshakePromise();
  }

  // delegate performance tracking to PreviewState
  get performanceObserver() {
    return this.state.performanceObserver;
  }

  get evaluationDuration(): number {
    return this.state.evaluationDuration;
  }

  set evaluationDuration(value: number) {
    this.state.evaluationDuration = value;
  }

  get previewDuration(): number {
    return this.state.previewDuration;
  }

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

  set typescriptConfiguration(value: TypeScriptConfiguration | undefined) {
    this.documentHandler.typescriptConfiguration = value;
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

    // initialize extracted state component
    this.state = new PreviewState();

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

    // create watchers w/ ready gate (callbacks wait for webview handshake)
    // NOTE: watchers are created but NOT started yet
    // ready gate - callbacks wait for handshake promise
    this.watcherManager = this.initializer.createWatchers(
      this.configManager.configuration.customCss,
      async (fsPath) => {
        await this.webviewBridge.invalidate(fsPath);
        await this.updateWebview(true);
      },
      this.webviewHandshakePromise
    );

    // initialize evaluator (needs this preview instance)
    this.evaluator = new PreviewEvaluator(
      this,
      this.documentHandler,
      this.configManager,
      this.watcherManager
    );

    // set document first (sets document directory for watchers)
    this.setDoc(doc);

    // then start watchers (now document directory is set)
    void this.initializer.startWatchers(this.watcherManager);

    // setup performance observer in development
    this.state.setupPerformanceObserver();
  }

  initWebviewHandshakePromise(): void {
    const handshake = this.initializer.createHandshake();
    this.webviewHandshakePromise = handshake.promise;
    this.resolveWebviewHandshakePromise = handshake.resolve;
  }

  setDoc(doc: vscode.TextDocument): void {
    this.documentHandler.setDoc(doc, this.watcherManager);
    this.setupConfigWatcher();
  }

  private setupConfigWatcher(): void {
    // setup config watcher directly via initializer (coordinator was removed)
    this.initializer.setupConfigWatcher(
      this.watcherManager,
      this.doc.uri.scheme,
      this.documentHandler.mdxPreviewConfig,
      () => {
        this.documentHandler.reloadMdxConfig();
        this.refreshWebview().catch((err) =>
          logError('Failed to refresh after config change', err)
        );
      }
    );
  }

  updateTailwindWatchFiles(watchFiles: string[]): void {
    // setup tailwind watcher directly via initializer (coordinator was removed)
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

  // delegate to PreviewState
  nextTailwindRequestId(): number {
    return this.state.nextTailwindRequestId();
  }

  // delegate to PreviewState
  isTailwindRequestCurrent(requestId: number): boolean {
    return this.state.isTailwindRequestCurrent(requestId);
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

  // delegate to PreviewEvaluator
  async updateWebview(force = false): Promise<void> {
    await this.evaluator.updateWebview(force);
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
      // setup custom CSS watcher directly via initializer (coordinator was removed)
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
    this.state.dispose();
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
