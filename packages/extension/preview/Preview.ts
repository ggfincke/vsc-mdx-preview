// packages/extension/preview/Preview.ts
// individual preview instance w/ stale detection & custom CSS support

import * as vscode from 'vscode';
import { createTaggedLogger } from '../logging';
import { LogTags } from '@mdx-preview/shared';

// module-level tagged logger
const log = createTaggedLogger(LogTags.PREVIEW);

import { refreshPanel } from './webview-manager';
import type { ResolvedConfig, TypeScriptConfiguration } from '../types';
import type { WatcherManager } from './watchers';

// extracted components for Preview class
import { PreviewState } from './PreviewState';
import { PreviewEvaluator } from './PreviewEvaluator';

// extracted modules
import {
  PreviewConfiguration,
  type StyleConfiguration,
  type ConfigurationState,
} from './PreviewConfiguration';
import {
  PreviewWebviewBridge,
  type WebviewHandle,
} from './PreviewWebviewBridge';
import { PreviewDocumentHandler } from './PreviewDocumentHandler';
import { PreviewInitializer } from './PreviewInitializer';

// import PreviewManager type for refreshWebview (controlled dependency via singleton lookup)
import type { PreviewManager } from './preview-manager';

// lazy import to avoid circular dependency at module load time (uses service-locator)
function getPreviewManager(): PreviewManager {
  const { getPreviewManager: getManager } = require('../services') as {
    getPreviewManager: () => PreviewManager;
  };
  return getManager();
}

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

  // cancel pending handshake timeout (call when reusing panel to prevent stale timeouts)
  cancelHandshakeTimeout(): void {
    this.initializer.cancelHandshakeTimeout();
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
    log.debug('Preview constructor called');

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

  // delegate to PreviewEvaluator
  async updateWebview(force = false): Promise<void> {
    await this.evaluator.updateWebview(force);
  }

  async refreshWebview(): Promise<void> {
    log.debug('refreshWebview called');
    const currentPreview = getPreviewManager().getCurrentPreview();
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
        log.error('Failed to refresh preview', err)
      );
    }
  }

  // dispose of resources held by this preview
  dispose(): void {
    this.state.dispose();
    this.watcherManager.dispose();
  }
}
