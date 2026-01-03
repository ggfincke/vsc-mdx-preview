// packages/extension/preview/preview-manager.ts
// * preview manager & preview instances w/ scroll sync, stale detection, & custom CSS support

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as typescript from 'typescript';
import { TextDecoder } from 'util';
import {
  performance,
  PerformanceObserver,
  PerformanceObserverEntryList,
} from 'perf_hooks';
import debounce from 'lodash.debounce';
import { error as logError, debug } from '../logging';

import { SecurityPolicy } from '../security/security';

import { createOrShowPanel, refreshPanel } from './webview-manager';
import evaluateInWebview from './evaluate-in-webview';

// update mode for preview refresh behavior
export type UpdateMode = 'onType' | 'onSave' | 'manual';

export interface StyleConfiguration {
  useVscodeMarkdownStyles: boolean;
  useWhiteBackground: boolean;
}

export interface TypeScriptConfiguration {
  tsCompilerOptions: typescript.CompilerOptions;
  tsCompilerHost: typescript.CompilerHost;
}

import type { WebviewHandleType } from '../rpc-extension';

export type WebviewHandle = WebviewHandleType;

// * preview manager singleton for managing all preview instances w/ scroll sync routing by URI
export class PreviewManager {
  private static instance: PreviewManager;
  private currentPreview: Preview | undefined;
  // uri-keyed map for scroll sync routing
  private previews = new Map<string, Preview>();
  private scrollSyncDisposable?: vscode.Disposable;

  private constructor() {}

  static getInstance(): PreviewManager {
    if (!PreviewManager.instance) {
      PreviewManager.instance = new PreviewManager();
    }
    return PreviewManager.instance;
  }

  // initialize scroll sync subscription (call once at activation)
  initScrollSync(context: vscode.ExtensionContext): void {
    debug('[PREVIEW-MGR] initScrollSync called');
    this.scrollSyncDisposable =
      vscode.window.onDidChangeTextEditorVisibleRanges((event) => {
        // route to correct preview by URI
        const key = event.textEditor.document.uri.toString(true);
        const preview = this.previews.get(key);
        if (preview?.active) {
          preview.handleEditorVisibleRangesChange(event.visibleRanges);
        }
      });
    context.subscriptions.push(this.scrollSyncDisposable);
  }

  // register preview for scroll sync routing
  registerPreview(preview: Preview): void {
    const key = preview.doc.uri.toString(true);
    debug(`[PREVIEW-MGR] registerPreview: ${key}`);
    this.previews.set(key, preview);
  }

  // unregister preview from scroll sync routing
  unregisterPreview(uri: vscode.Uri): void {
    const key = uri.toString(true);
    debug(`[PREVIEW-MGR] unregisterPreview: ${key}`);
    this.previews.delete(key);
  }

  // get current preview
  getCurrentPreview(): Preview | undefined {
    return this.currentPreview;
  }

  // set current preview
  setCurrentPreview(preview: Preview | undefined): void {
    this.currentPreview = preview;
  }

  // refresh all active previews (e.g., when trust state changes)
  refreshAllPreviews(): void {
    if (this.currentPreview?.active) {
      this.currentPreview.refreshWebview();
    }
  }

  // check if there are any active previews
  hasActivePreviews(): boolean {
    return this.currentPreview?.active ?? false;
  }
}

// get current preview through manager (backward compatibility)
export function getCurrentPreview(): Preview | undefined {
  return PreviewManager.getInstance().getCurrentPreview();
}

export class Preview {
  doc!: vscode.TextDocument;
  active = false;
  editingDoc: vscode.TextDocument | undefined;
  dependentFsPaths: Set<string> = new Set();
  webviewHandle!: WebviewHandle;
  webviewHandshakePromise!: Promise<void>;
  resolveWebviewHandshakePromise!: () => void;

  webview?: vscode.Webview;

  // version tracking for stale detection
  private lastRenderedVersion = -1;
  private isStale = false;

  // reset rendered version (called when panel is disposed to force re-render on reopen)
  resetRenderedVersion(): void {
    this.lastRenderedVersion = -1;
  }

  // debounced update function (created in constructor)
  private debouncedUpdateWebview: ReturnType<typeof debounce>;

  // custom CSS file watcher
  private customCssWatcher?: vscode.FileSystemWatcher;
  private customCssDisposables: vscode.Disposable[] = [];

  // scroll sync
  private scrollSyncEnabled = true;
  private scrollSyncBehavior: 'instant' | 'smooth' = 'instant';
  private scrollSyncCooldown = false;
  private latestVisibleLine = 0;

  // debounced editor scroll handler (75ms trailing)
  private debouncedEditorScroll = debounce(() => {
    if (!this.scrollSyncEnabled || this.scrollSyncCooldown) {
      return;
    }
    // convert 0-based (VS Code) to 1-based (unified)
    const previewLine = this.latestVisibleLine + 1;
    debug(`[PREVIEW] scrollToLine: ${previewLine}`);
    this.webviewHandle?.scrollToLine?.(previewLine);
  }, 75);

  getWebviewUri(fsPath: string): string | undefined {
    if (!this.webview) {
      return undefined;
    }
    return this.webview.asWebviewUri(vscode.Uri.file(fsPath)).toString();
  }

  configuration: {
    updateMode: UpdateMode;
    debounceDelay: number;
    useVscodeMarkdownStyles: boolean;
    useWhiteBackground: boolean;
    customLayoutFilePath: string;
    customCss: string;
    useSucraseTranspiler: boolean;
    securityPolicy: SecurityPolicy;
  };

  typescriptConfiguration?: TypeScriptConfiguration;
  performanceObserver?: PerformanceObserver;
  evaluationDuration = 0;
  previewDuration = 0;

  get styleConfiguration(): StyleConfiguration {
    return {
      useVscodeMarkdownStyles: this.configuration.useVscodeMarkdownStyles,
      useWhiteBackground: this.configuration.useWhiteBackground,
    };
  }

  get securityConfiguration() {
    return { securityPolicy: this.configuration.securityPolicy };
  }

  // generate TypeScript configuration from tsconfig.json (full resolution of extends, references, paths, baseUrl)
  generateTypescriptConfiguration(configFile: string | null): void {
    let tsCompilerOptions: typescript.CompilerOptions;

    if (configFile) {
      // Use getParsedCommandLineOfConfigFile for full tsconfig resolution
      // This properly handles extends, paths, baseUrl, references, etc.
      const parsedConfig = typescript.getParsedCommandLineOfConfigFile(
        configFile,
        {}, // existing options to merge
        {
          ...typescript.sys,
          onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
            logError(
              'TypeScript config error',
              typescript.flattenDiagnosticMessageText(
                diagnostic.messageText,
                '\n'
              )
            );
          },
        }
      );

      if (parsedConfig) {
        tsCompilerOptions = parsedConfig.options;
      } else {
        // Fallback if parsing fails
        tsCompilerOptions = typescript.getDefaultCompilerOptions();
      }
    } else {
      tsCompilerOptions = typescript.getDefaultCompilerOptions();
    }

    // Override certain options for preview purposes
    delete tsCompilerOptions.emitDeclarationOnly;
    delete tsCompilerOptions.declaration;
    tsCompilerOptions.module = typescript.ModuleKind.ESNext;
    tsCompilerOptions.target = typescript.ScriptTarget.ESNext;
    tsCompilerOptions.noEmitHelpers = false;
    tsCompilerOptions.importHelpers = false;

    const tsCompilerHost = typescript.createCompilerHost(tsCompilerOptions);

    this.typescriptConfiguration = {
      tsCompilerHost,
      tsCompilerOptions,
    };
  }

  initWebviewHandshakePromise(): void {
    debug('[PREVIEW] initWebviewHandshakePromise called');
    const HANDSHAKE_TIMEOUT_MS = 10000; // 10 seconds

    const handshakePromise = new Promise<void>((resolve) => {
      this.resolveWebviewHandshakePromise = () => {
        debug('[PREVIEW] Handshake resolved!');
        resolve();
      };
    });

    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => {
        debug('[PREVIEW] Handshake TIMEOUT after 10 seconds');
        reject(
          new Error(
            'Webview handshake timeout - the preview failed to initialize within 10 seconds'
          )
        );
      }, HANDSHAKE_TIMEOUT_MS);
    });

    this.webviewHandshakePromise = Promise.race([
      handshakePromise,
      timeoutPromise,
    ]);
  }

  constructor(doc: vscode.TextDocument) {
    debug('[PREVIEW] Preview constructor called');
    const extensionConfig = vscode.workspace.getConfiguration(
      'mdx-preview',
      doc.uri
    );

    const debounceDelay = extensionConfig.get<number>(
      'preview.debounceDelay',
      300
    );

    this.configuration = {
      updateMode: extensionConfig.get<UpdateMode>(
        'preview.updateMode',
        'onType'
      ),
      debounceDelay,
      useSucraseTranspiler: extensionConfig.get<boolean>(
        'build.useSucraseTranspiler',
        false
      ),
      useVscodeMarkdownStyles: extensionConfig.get<boolean>(
        'preview.useVscodeMarkdownStyles',
        true
      ),
      useWhiteBackground: extensionConfig.get<boolean>(
        'preview.useWhiteBackground',
        false
      ),
      customLayoutFilePath: extensionConfig.get<string>(
        'preview.mdx.customLayoutFilePath',
        ''
      ),
      customCss: extensionConfig.get<string>('preview.customCss', ''),
      securityPolicy: extensionConfig.get<SecurityPolicy>(
        'preview.security',
        SecurityPolicy.Strict
      ),
    };

    // Phase 2.2: Read scroll sync settings
    this.scrollSyncEnabled = extensionConfig.get<boolean>(
      'preview.scrollSync',
      true
    );
    this.scrollSyncBehavior = extensionConfig.get<'instant' | 'smooth'>(
      'preview.scrollBehavior',
      'instant'
    );

    // Create debounced update function
    this.debouncedUpdateWebview = debounce(
      () => this.updateWebview(),
      debounceDelay
    );

    this.setDoc(doc);

    // Initialize custom CSS watcher
    this.setupCustomCssWatcher();

    // Phase 2.2: Register with PreviewManager for scroll sync routing
    PreviewManager.getInstance().registerPreview(this);

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

  setDoc(doc: vscode.TextDocument): void {
    this.doc = doc;
    this.dependentFsPaths = new Set([doc.uri.fsPath]);

    const configFile = typescript.findConfigFile(
      this.entryFsDirectory ?? '',
      typescript.sys.fileExists
    );
    if (configFile) {
      this.generateTypescriptConfiguration(configFile);
    } else {
      this.typescriptConfiguration = undefined;
    }
  }

  get fsPath(): string {
    return this.doc.uri.fsPath;
  }

  get text(): string {
    return this.doc.getText();
  }

  get entryFsDirectory(): string | null {
    if (this.doc.uri.scheme === 'untitled') {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        return null;
      }
      return workspaceFolders[0].uri.fsPath;
    } else if (this.doc.uri.scheme === 'file') {
      return path.dirname(this.fsPath);
    }
    return null;
  }

  async updateWebview(force = false): Promise<void> {
    debug('[PREVIEW] updateWebview called');
    const { uri } = this.doc;
    const { scheme, fsPath } = uri;
    debug(`[PREVIEW] updateWebview scheme=${scheme}, fsPath=${fsPath}`);

    // Track version for stale detection
    const currentVersion = this.doc.version;

    // Skip if we've already rendered this version (unless forced)
    if (!force && currentVersion === this.lastRenderedVersion) {
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
        // In onType mode, use in-memory text; in onSave mode, read from disk
        if (this.configuration.updateMode === 'onType') {
          await evaluateInWebview(this, this.text, fsPath);
        } else {
          // ASYNC: Use fs.promises.readFile instead of fs.readFileSync
          const text = await fs.promises.readFile(fsPath, { encoding: 'utf8' });
          await evaluateInWebview(this, text, fsPath);
        }
        break;
      }
      default: {
        debug(`[PREVIEW] updateWebview: default scheme (${scheme})`);
        // Non-file/virtual schemes (vscode-remote, git, vscode-userdata, etc.)
        // Safe Mode should still render using document text.
        let text = this.text;
        if (this.configuration.updateMode !== 'onType') {
          try {
            const bytes = await vscode.workspace.fs.readFile(uri);
            text = new TextDecoder().decode(bytes);
          } catch {
            // Fall back to in-memory text if readFile isn't supported
            text = this.text;
          }
        }
        await evaluateInWebview(this, text, fsPath);
        break;
      }
    }

    // Update tracking after successful render
    this.lastRenderedVersion = currentVersion;
    this.markNotStale();
  }

  // Mark preview as stale (document changed but not rendered)
  markStale(): void {
    if (!this.isStale) {
      this.isStale = true;
      // Notify webview of stale state
      this.webviewHandle?.setStale?.(true);
    }
  }

  // Mark preview as not stale (just rendered)
  private markNotStale(): void {
    if (this.isStale) {
      this.isStale = false;
      // Notify webview of not-stale state
      this.webviewHandle?.setStale?.(false);
    }
  }

  // Phase 2.2: Handle editor visible ranges change (called by PreviewManager)
  handleEditorVisibleRangesChange(ranges: readonly vscode.Range[]): void {
    if (ranges.length === 0) {
      return;
    }
    // Coalesce: store latest, debounced send
    this.latestVisibleLine = ranges[0].start.line;
    this.debouncedEditorScroll();
  }

  // Phase 2.2: Handle preview scroll (called via RPC from webview)
  handlePreviewScroll(line: number): void {
    if (!this.scrollSyncEnabled || this.scrollSyncCooldown) {
      return;
    }

    // Set cooldown to prevent loop
    this.scrollSyncCooldown = true;
    setTimeout(() => {
      this.scrollSyncCooldown = false;
    }, 150);

    // Convert 1-based (unified) to 0-based (VS Code)
    const editorLine = line - 1;

    // Reveal in active editor if it matches this preview's document
    const editor = vscode.window.activeTextEditor;
    if (
      editor &&
      editor.document.uri.toString(true) === this.doc.uri.toString(true)
    ) {
      const range = new vscode.Range(editorLine, 0, editorLine, 0);
      editor.revealRange(range, vscode.TextEditorRevealType.AtTop);
    }
  }

  // Phase 2.2: Push scroll sync config to webview
  private pushScrollSyncConfig(): void {
    this.webviewHandle?.setScrollSyncConfig?.({
      enabled: this.scrollSyncEnabled,
      behavior: this.scrollSyncBehavior,
    });
  }

  // Phase 2.1: Setup custom CSS file watcher
  private setupCustomCssWatcher(): void {
    // Clean up any existing watcher
    this.disposeCustomCssWatcher();

    const cssPath = this.configuration.customCss;
    if (!cssPath) {
      return;
    }

    // Resolve path relative to workspace or document
    const resolvedPath = this.resolveCustomCssPath(cssPath);
    if (!resolvedPath) {
      return;
    }

    // Initial load
    this.loadAndSendCustomCss(resolvedPath);

    // Watch for changes
    this.customCssWatcher =
      vscode.workspace.createFileSystemWatcher(resolvedPath);

    this.customCssDisposables.push(
      this.customCssWatcher.onDidChange(() => {
        debug('[PREVIEW] Custom CSS file changed');
        this.loadAndSendCustomCss(resolvedPath);
      }),
      this.customCssWatcher.onDidCreate(() => {
        debug('[PREVIEW] Custom CSS file created');
        this.loadAndSendCustomCss(resolvedPath);
      }),
      this.customCssWatcher.onDidDelete(() => {
        debug('[PREVIEW] Custom CSS file deleted');
        // Clear custom CSS
        this.webviewHandle?.setCustomCss?.('');
      }),
      this.customCssWatcher
    );
  }

  // Resolve custom CSS path (relative to workspace or absolute)
  private resolveCustomCssPath(cssPath: string): string | null {
    if (path.isAbsolute(cssPath)) {
      return cssPath;
    }

    // Try relative to workspace root
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      return path.join(workspaceFolders[0].uri.fsPath, cssPath);
    }

    // Try relative to document
    if (this.entryFsDirectory) {
      return path.join(this.entryFsDirectory, cssPath);
    }

    return null;
  }

  // Load and send custom CSS to webview
  private async loadAndSendCustomCss(cssPath: string): Promise<void> {
    try {
      const cssContent = await fs.promises.readFile(cssPath, 'utf-8');
      this.webviewHandle?.setCustomCss?.(cssContent);
      debug(
        `[PREVIEW] Loaded custom CSS: ${cssPath} (${cssContent.length} chars)`
      );
    } catch (err) {
      debug(`[PREVIEW] Failed to load custom CSS: ${err}`);
      // Silently fail - file might not exist yet
    }
  }

  // Clean up custom CSS watcher
  private disposeCustomCssWatcher(): void {
    for (const disposable of this.customCssDisposables) {
      disposable.dispose();
    }
    this.customCssDisposables = [];
    this.customCssWatcher = undefined;
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
    if (!this.active) {
      return;
    }

    // Only process if this is a dependent file
    if (!this.dependentFsPaths.has(fsPath)) {
      return;
    }

    this.editingDoc = doc;

    // Handle based on update mode
    switch (this.configuration.updateMode) {
      case 'onType': {
        // Mark as stale immediately, then debounced update
        this.markStale();
        if (fsPath !== this.fsPath) {
          await this.webviewHandle.invalidate(fsPath);
        }
        // Use debounced update for on-type mode
        this.debouncedUpdateWebview();
        break;
      }
      case 'onSave':
      case 'manual': {
        // Just mark as stale, don't update
        this.markStale();
        break;
      }
    }
  }

  async handleDidSaveTextDocument(fsPath: string): Promise<void> {
    if (!this.active) {
      return;
    }

    if (!this.dependentFsPaths.has(fsPath)) {
      return;
    }

    // In onSave mode, update on save; in onType mode, also update to ensure
    // we have the disk version; in manual mode, just mark stale
    if (this.configuration.updateMode === 'manual') {
      this.markStale();
      return;
    }

    if (fsPath !== this.fsPath) {
      await this.webviewHandle.invalidate(fsPath);
    }
    await this.updateWebview();
  }

  updateConfiguration(): void {
    const extensionConfig = vscode.workspace.getConfiguration(
      'mdx-preview',
      this.doc.uri
    );

    const updateMode = extensionConfig.get<UpdateMode>(
      'preview.updateMode',
      'onType'
    );
    const debounceDelay = extensionConfig.get<number>(
      'preview.debounceDelay',
      300
    );
    const useSucraseTranspiler = extensionConfig.get<boolean>(
      'build.useSucraseTranspiler',
      false
    );
    const useVscodeMarkdownStyles = extensionConfig.get<boolean>(
      'preview.useVscodeMarkdownStyles',
      true
    );
    const useWhiteBackground = extensionConfig.get<boolean>(
      'preview.useWhiteBackground',
      false
    );
    const customLayoutFilePath = extensionConfig.get<string>(
      'preview.mdx.customLayoutFilePath',
      ''
    );
    const customCss = extensionConfig.get<string>('preview.customCss', '');
    const securityPolicy = extensionConfig.get<SecurityPolicy>(
      'preview.security',
      SecurityPolicy.Strict
    );

    // Phase 2.2: Read scroll sync settings
    const scrollSync = extensionConfig.get<boolean>('preview.scrollSync', true);
    const scrollBehavior = extensionConfig.get<'instant' | 'smooth'>(
      'preview.scrollBehavior',
      'instant'
    );

    const needsWebviewRefresh =
      useVscodeMarkdownStyles !== this.configuration.useVscodeMarkdownStyles ||
      useWhiteBackground !== this.configuration.useWhiteBackground ||
      customLayoutFilePath !== this.configuration.customLayoutFilePath ||
      securityPolicy !== this.configuration.securityPolicy;

    // Phase 2.2: Push scroll sync config if changed
    if (
      scrollSync !== this.scrollSyncEnabled ||
      scrollBehavior !== this.scrollSyncBehavior
    ) {
      this.scrollSyncEnabled = scrollSync;
      this.scrollSyncBehavior = scrollBehavior;
      this.pushScrollSyncConfig();
    }

    // Recreate debounced function if delay changed
    if (debounceDelay !== this.configuration.debounceDelay) {
      this.debouncedUpdateWebview = debounce(
        () => this.updateWebview(),
        debounceDelay
      );
    }

    // Reinitialize custom CSS watcher if path changed
    if (customCss !== this.configuration.customCss) {
      this.configuration.customCss = customCss;
      this.setupCustomCssWatcher();
    }

    Object.assign(this.configuration, {
      updateMode,
      debounceDelay,
      useSucraseTranspiler,
      useVscodeMarkdownStyles,
      useWhiteBackground,
      customLayoutFilePath,
      customCss,
      securityPolicy,
    });

    if (needsWebviewRefresh) {
      // Fire and forget - don't block on refresh
      this.refreshWebview().catch((err) =>
        logError('Failed to refresh preview', err)
      );
    }
  }

  // called after webview handshake to push initial config
  onWebviewReady(): void {
    debug('[PREVIEW] onWebviewReady - pushing initial config');
    this.pushScrollSyncConfig();
  }

  // dispose of resources held by this preview
  dispose(): void {
    this.disposeCustomCssWatcher();
    // Phase 2.2: Unregister from PreviewManager
    PreviewManager.getInstance().unregisterPreview(this.doc.uri);
  }
}

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
