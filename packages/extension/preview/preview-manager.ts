// packages/extension/preview/preview-manager.ts
// * preview manager & preview instances w/ stale detection & custom CSS support

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { TextDecoder } from 'util';
import {
  performance,
  PerformanceObserver,
  PerformanceObserverEntryList,
} from 'perf_hooks';
import debounce from 'lodash.debounce';
import { error as logError, debug } from '../logging';

import { SecurityPolicy } from '../security/security';
import { ThemeManager } from '../themes';

import { createOrShowPanel, refreshPanel } from './webview-manager';
import evaluateInWebview from './evaluate-in-webview';
import {
  resolveTypescriptConfig,
  findTsConfig,
  resolveConfig,
  onConfigChange,
  disposeConfigWatchers,
  type TypeScriptConfiguration,
  type ResolvedConfig,
} from './config';
import {
  DocumentTracker,
  CustomCssWatcher,
  DependencyWatcher,
} from './watchers';

// update mode for preview refresh behavior
export type UpdateMode = 'onType' | 'onSave' | 'manual';

export interface StyleConfiguration {
  useVscodeMarkdownStyles: boolean;
  useWhiteBackground: boolean;
}

// re-export for backward compatibility
export type { TypeScriptConfiguration } from './config';

import type { WebviewHandleType } from '../rpc-extension';

export type WebviewHandle = WebviewHandleType;

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
  doc!: vscode.TextDocument;
  active = false;
  editingDoc: vscode.TextDocument | undefined;
  dependentFsPaths: Set<string> = new Set();
  webviewHandle!: WebviewHandle;
  webviewHandshakePromise!: Promise<void>;
  resolveWebviewHandshakePromise!: () => void;

  webview?: vscode.Webview;

  // composed modules for separation of concerns
  private documentTracker = new DocumentTracker();
  private customCssWatcher?: CustomCssWatcher;
  private dependencyWatcher?: DependencyWatcher;

  // debounced update function (created in constructor)
  private debouncedUpdateWebview: ReturnType<typeof debounce>;

  // reset rendered version (called when panel is disposed to force re-render)
  resetRenderedVersion(): void {
    this.documentTracker.resetRenderedVersion();
  }

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
  mdxPreviewConfig?: ResolvedConfig;
  private configChangeDisposable?: vscode.Disposable;
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

  initWebviewHandshakePromise(): void {
    debug('[PREVIEW] initWebviewHandshakePromise called');
    const HANDSHAKE_TIMEOUT_MS = 10000;

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

    // create debounced update function
    this.debouncedUpdateWebview = debounce(
      () => this.updateWebview(),
      debounceDelay
    );

    this.setDoc(doc);

    // initialize custom CSS watcher
    this.setupCustomCssWatcher();

    // initialize dependency watcher for local imports
    this.setupDependencyWatcher();

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

    const configFile = findTsConfig(this.entryFsDirectory ?? '');
    if (configFile) {
      this.typescriptConfiguration = resolveTypescriptConfig(configFile);
    } else {
      this.typescriptConfiguration = undefined;
    }

    // resolve MDX preview config file (.mdx-previewrc.json)
    if (doc.uri.scheme === 'file') {
      this.mdxPreviewConfig = resolveConfig(doc.uri.fsPath) ?? undefined;
      this.setupConfigChangeListener();
    } else {
      this.mdxPreviewConfig = undefined;
    }

    // update dependency watcher's document directory
    if (this.entryFsDirectory && this.dependencyWatcher) {
      this.dependencyWatcher.setDocumentDir(this.entryFsDirectory);
      this.dependencyWatcher.clear(); // clear old dependencies when switching documents
    }
  }

  // setup listener for config file changes
  private setupConfigChangeListener(): void {
    this.configChangeDisposable?.dispose();

    if (!this.mdxPreviewConfig) {
      return;
    }

    const configPath = this.mdxPreviewConfig.configPath;
    this.configChangeDisposable = onConfigChange((changedPath) => {
      if (changedPath === configPath) {
        debug('[PREVIEW] MDX config file changed, reloading...');
        // re-resolve config
        this.mdxPreviewConfig = resolveConfig(this.doc.uri.fsPath) ?? undefined;
        // trigger full refresh since plugins may have changed
        this.refreshWebview().catch((err) =>
          logError('Failed to refresh after config change', err)
        );
      }
    });
  }

  // set webview handle & connect it to composed modules
  setWebviewHandle(handle: WebviewHandle): void {
    this.webviewHandle = handle;
    this.documentTracker.setNotifier(handle);
    this.customCssWatcher?.setNotifier(handle);
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

    const currentVersion = this.doc.version;

    // skip if we've already rendered this version (unless forced)
    if (!force && this.documentTracker.hasRenderedVersion(currentVersion)) {
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
    this.documentTracker.markRendered(currentVersion);
  }

  // mark preview as stale (document changed but not rendered)
  markStale(): void {
    this.documentTracker.markStale();
  }

  // setup custom CSS file watcher
  private setupCustomCssWatcher(): void {
    this.customCssWatcher?.dispose();

    const cssPath = this.configuration.customCss;
    if (!cssPath) {
      this.customCssWatcher = undefined;
      return;
    }

    this.customCssWatcher = new CustomCssWatcher(
      cssPath,
      vscode.workspace.workspaceFolders,
      this.entryFsDirectory
    );

    // connect notifier if webview handle exists
    if (this.webviewHandle) {
      this.customCssWatcher.setNotifier(this.webviewHandle);
    }

    this.customCssWatcher.watch();
  }

  // setup dependency watcher for local imports
  private setupDependencyWatcher(): void {
    this.dependencyWatcher?.dispose();

    this.dependencyWatcher = new DependencyWatcher(async (fsPath) => {
      debug(`[PREVIEW] Dependency changed: ${fsPath}`);
      if (this.webviewHandle) {
        await this.webviewHandle.invalidate(fsPath);
      }
      await this.updateWebview(true); // force refresh
    });

    // set document directory for resolving relative imports
    if (this.entryFsDirectory) {
      this.dependencyWatcher.setDocumentDir(this.entryFsDirectory);
    }
  }

  // update dependency watcher with new imports (called from evaluate-in-webview)
  updateDependencies(imports: string[]): void {
    this.dependencyWatcher?.updateDependencies(imports);
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

    if (!this.dependentFsPaths.has(fsPath)) {
      return;
    }

    this.editingDoc = doc;

    switch (this.configuration.updateMode) {
      case 'onType': {
        this.markStale();
        if (fsPath !== this.fsPath) {
          await this.webviewHandle.invalidate(fsPath);
        }
        this.debouncedUpdateWebview();
        break;
      }
      case 'onSave':
      case 'manual': {
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

    const needsWebviewRefresh =
      useVscodeMarkdownStyles !== this.configuration.useVscodeMarkdownStyles ||
      useWhiteBackground !== this.configuration.useWhiteBackground ||
      customLayoutFilePath !== this.configuration.customLayoutFilePath ||
      securityPolicy !== this.configuration.securityPolicy;

    // recreate debounced function if delay changed
    if (debounceDelay !== this.configuration.debounceDelay) {
      this.debouncedUpdateWebview = debounce(
        () => this.updateWebview(),
        debounceDelay
      );
    }

    // reinitialize custom CSS watcher if path changed
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
      this.refreshWebview().catch((err) =>
        logError('Failed to refresh preview', err)
      );
    }
  }

  // called after webview handshake to push initial config
  onWebviewReady(): void {
    debug('[PREVIEW] onWebviewReady - pushing initial config');
    this.pushThemeState();
  }

  // push theme state to webview (public for theme refresh w/o full webview refresh)
  pushThemeState(frontmatter?: Record<string, unknown>): void {
    if (!this.webviewHandle) {
      return;
    }
    const themeManager = ThemeManager.getInstance();
    let themeState = themeManager.getWebviewThemeState(this.doc.uri);

    // apply frontmatter theme overrides if present
    if (frontmatter) {
      const frontmatterTheme =
        themeManager.extractThemeFromFrontmatter(frontmatter);
      if (frontmatterTheme.previewTheme) {
        themeState = {
          ...themeState,
          previewTheme: frontmatterTheme.previewTheme,
        };
      }
      if (frontmatterTheme.codeBlockTheme) {
        themeState = {
          ...themeState,
          codeBlockTheme: frontmatterTheme.codeBlockTheme,
        };
      }
    }

    debug('[PREVIEW] pushThemeState - pushing theme state', themeState);
    this.webviewHandle.setTheme(themeState);
  }

  // dispose of resources held by this preview
  dispose(): void {
    this.customCssWatcher?.dispose();
    this.configChangeDisposable?.dispose();
    this.dependencyWatcher?.dispose();
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
