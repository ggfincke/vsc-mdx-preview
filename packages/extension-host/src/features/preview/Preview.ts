// packages/extension-host/src/features/preview/Preview.ts
// individual preview instance w/ stale detection & custom CSS support

import * as vscode from 'vscode';
import {
  PerformanceObserver,
  type PerformanceObserverEntryList,
  performance,
} from 'perf_hooks';
import { createTaggedLogger } from '../../shared/logging/logger';
import { LogTags } from '@mdx-preview/contracts';

// module-level tagged logger
const log = createTaggedLogger(LogTags.PREVIEW);

import { refreshPanel } from './webview-manager';
import evaluateInWebview from './evaluate-in-webview';
import type { ResolvedConfig, TypeScriptConfiguration } from '../types';
import type { WatcherManager, DocumentTracker } from './watchers';

// extracted modules
import {
  PreviewConfiguration,
  type StyleConfiguration,
  type ConfigurationState,
  type PreviewRuntimeConfig,
} from './PreviewConfiguration';
import {
  PreviewWebviewBridge,
  type WebviewHandle,
} from './PreviewWebviewBridge';
import { PreviewDocumentHandler } from './PreviewDocumentHandler';
import { PreviewInitializer } from './PreviewInitializer';
import { getPreviewManager } from '../../app/services/service-locator';
import { runPreviewUpdateFlow } from './preview-update-flow';
import { runPreviewRefreshFlow } from './preview-refresh-flow';

// re-export types for consumers
export type { StyleConfiguration, WebviewHandle };

// * individual preview instance for a document (manage webview, evaluation, & watchers)
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

  // Tailwind request ID counter (ensure stale responses are ignored)
  private tailwindRequestId = 0;
  private tailwindBrowserRuntimeEnabled = false;
  private tailwindFallbackReason: string | null = null;

  // performance tracking (development only)
  private _performanceObserver?: PerformanceObserver;
  private _evaluationDuration = 0;
  private _previewDuration = 0;

  // handshake state
  webviewHandshakePromise!: Promise<void>;
  private resolveWebviewHandshakePromise!: () => void;

  // public method for RPC handle to complete handshake
  completeHandshake(): void {
    this.resolveWebviewHandshakePromise();
  }

  // cancel pending handshake timeout (call when reusing panel to prevent stale timeouts)
  cancelHandshakeTimeout(): void {
    this.initializer.cancelHandshakeTimeout();
  }

  get evaluationDuration(): number {
    return this._evaluationDuration;
  }

  set evaluationDuration(value: number) {
    this._evaluationDuration = value;
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

  get runtimeConfiguration(): PreviewRuntimeConfig {
    return this.configManager.runtimeConfiguration;
  }

  get webviewHandle(): WebviewHandle {
    return this.webviewBridge.getHandle()!;
  }

  constructor(doc: vscode.TextDocument) {
    log.debug('Preview constructor called');

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

    // create watchers w/ ready gate (callbacks wait for webview handshake, not started yet)
    this.watcherManager = this.initializer.createWatchers(
      this.configManager.configuration.customCss,
      async (fsPath) => {
        if (!this.active) {
          return;
        }
        await this.webviewBridge.invalidate(fsPath);
        await this.updateWebview(true);
      },
      this.webviewHandshakePromise
    );

    // set document handler actions (provides callbacks w/out per-call injection)
    this.documentHandler.setActions({
      markStale: () => this.markStale(),
      invalidate: (fsPath) => this.webviewBridge.invalidate(fsPath),
      debouncedUpdate: () => this.configManager.debouncedUpdateWebview(),
      updateWebview: () => this.updateWebview(),
    });

    // set document first (sets document directory for watchers)
    this.setDoc(doc);

    // then start watchers (now document directory is set)
    void this.initializer.startWatchers(this.watcherManager);

    // setup performance observer (development only)
    if (process.env.NODE_ENV === 'development') {
      this._performanceObserver = new PerformanceObserver(
        (list: PerformanceObserverEntryList) => {
          this._previewDuration = list.getEntries()[0].duration;
          vscode.window.showInformationMessage(
            `Previewing used: ${Number(this._previewDuration / 1000).toFixed(2)} seconds. ` +
              `Evaluation used: ${Number(this._evaluationDuration / 1000).toFixed(2)} seconds.`
          );
          performance.clearMarks();
        }
      );
      this._performanceObserver.observe({ entryTypes: ['measure'] });
    }
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
          log.error('Failed to refresh after config change', err)
        );
      }
    );
  }

  updateTailwindWatchFiles(watchFiles: string[]): void {
    // setup tailwind watcher directly via initializer (coordinator was removed)
    this.initializer.setupTailwindConfigWatcher(
      this.watcherManager,
      watchFiles,
      (_changedPaths) => {
        this.updateWebview(true).catch((err) =>
          log.error('Failed to refresh after Tailwind change', err)
        );
      }
    );
  }

  // get next Tailwind request ID (increment for each new compilation)
  nextTailwindRequestId(): number {
    this.tailwindRequestId += 1;
    return this.tailwindRequestId;
  }

  // check if Tailwind request ID is still current (not superseded)
  isTailwindRequestCurrent(requestId: number): boolean {
    return requestId === this.tailwindRequestId;
  }

  // toggle whether the webview HTML should include the Tailwind browser runtime script
  setTailwindBrowserRuntimeEnabled(enabled: boolean): boolean {
    if (this.tailwindBrowserRuntimeEnabled === enabled) {
      return false;
    }
    this.tailwindBrowserRuntimeEnabled = enabled;
    return true;
  }

  isTailwindBrowserRuntimeEnabled(): boolean {
    return this.tailwindBrowserRuntimeEnabled;
  }

  // return true only when the fallback reason changed (used for one-time user messaging)
  markTailwindFallbackReason(reason: string): boolean {
    if (this.tailwindFallbackReason === reason) {
      return false;
    }
    this.tailwindFallbackReason = reason;
    return true;
  }

  clearTailwindFallbackReason(): void {
    this.tailwindFallbackReason = null;
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

  pushRuntimeConfiguration(): void {
    this.webviewBridge.pushRuntimeConfiguration(this.runtimeConfiguration);
  }

  // clear all caches in the webview (for manual cache refresh command)
  async clearAllCaches(): Promise<void> {
    await this.webviewBridge.clearAllCaches();
  }

  markStale(): void {
    this.documentHandler.markStale(this.watcherManager);
  }

  updateDependencies(imports: string[]): void {
    this.documentHandler.updateDependencies(imports, this.watcherManager);
  }

  // update webview w/ current document content (force bypasses version tracking)
  async updateWebview(force = false): Promise<void> {
    await runPreviewUpdateFlow({
      force,
      doc: this.doc,
      text: this.text,
      entryFsDirectory: this.entryFsDirectory,
      updateMode: this.configuration.updateMode,
      getDocumentTracker: () =>
        this.watcherManager.get<DocumentTracker>('document'),
      evaluate: (content, targetFsPath) =>
        evaluateInWebview(this, content, targetFsPath),
    });
  }

  async refreshWebview(): Promise<void> {
    await runPreviewRefreshFlow({
      getCurrentPreview: () => getPreviewManager().getCurrentPreview(),
      refreshPanel,
      updateWebviewForce: () => this.updateWebview(true),
    });
  }

  async handleDidChangeTextDocument(
    fsPath: string,
    doc: vscode.TextDocument
  ): Promise<void> {
    await this.documentHandler.handleDidChangeTextDocument(
      fsPath,
      doc,
      this.active,
      this.configuration.updateMode
    );
  }

  async handleDidSaveTextDocument(fsPath: string): Promise<void> {
    await this.documentHandler.handleDidSaveTextDocument(
      fsPath,
      this.active,
      this.configuration.updateMode
    );
  }

  updateConfiguration(): void {
    const result = this.configManager.updateConfiguration(this.doc.uri, () =>
      this.updateWebview()
    );

    if (result.needsRuntimeConfigPush) {
      this.pushRuntimeConfiguration();
    }

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
        log.error('Failed to refresh preview', err)
      );
    }
  }

  // dispose of resources held by this preview
  dispose(): void {
    this._performanceObserver?.disconnect();
    this._performanceObserver = undefined;
    this.watcherManager.dispose();
  }
}
