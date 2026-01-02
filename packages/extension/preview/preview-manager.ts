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
import { error as logError, debug } from '../logging';

import { SecurityPolicy } from '../security/security';

import { createOrShowPanel, refreshPanel } from './webview-manager';
import evaluateInWebview from './evaluate-in-webview';

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

/**
 * Preview Manager singleton for managing all preview instances.
 */
export class PreviewManager {
  private static instance: PreviewManager;
  private currentPreview: Preview | undefined;

  private constructor() {}

  static getInstance(): PreviewManager {
    if (!PreviewManager.instance) {
      PreviewManager.instance = new PreviewManager();
    }
    return PreviewManager.instance;
  }

  /**
   * Get the current preview.
   */
  getCurrentPreview(): Preview | undefined {
    return this.currentPreview;
  }

  /**
   * Set the current preview.
   */
  setCurrentPreview(preview: Preview | undefined): void {
    this.currentPreview = preview;
  }

  /**
   * Refresh all active previews (e.g., when trust state changes).
   */
  refreshAllPreviews(): void {
    if (this.currentPreview?.active) {
      this.currentPreview.refreshWebview();
    }
  }
}

// For backward compatibility - get current preview through manager
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

  getWebviewUri(fsPath: string): string | undefined {
    if (!this.webview) {
      return undefined;
    }
    return this.webview.asWebviewUri(vscode.Uri.file(fsPath)).toString();
  }

  configuration: {
    previewOnChange: boolean;
    useVscodeMarkdownStyles: boolean;
    useWhiteBackground: boolean;
    customLayoutFilePath: string;
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

  /**
   * Generate TypeScript configuration from a tsconfig.json file.
   * Uses getParsedCommandLineOfConfigFile for full resolution of:
   * - extends
   * - references
   * - paths
   * - baseUrl
   */
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
    this.configuration = {
      previewOnChange: extensionConfig.get<boolean>(
        'preview.previewOnChange',
        true
      ),
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
      securityPolicy: extensionConfig.get<SecurityPolicy>(
        'preview.security',
        SecurityPolicy.Strict
      ),
    };

    this.setDoc(doc);

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

  async updateWebview(): Promise<void> {
    debug('[PREVIEW] updateWebview called');
    const { uri } = this.doc;
    const { scheme, fsPath } = uri;
    debug(`[PREVIEW] updateWebview scheme=${scheme}, fsPath=${fsPath}`);

    switch (scheme) {
      case 'untitled': {
        debug('[PREVIEW] updateWebview: untitled scheme');
        await evaluateInWebview(this, this.text, this.entryFsDirectory ?? '');
        return;
      }
      case 'file': {
        debug('[PREVIEW] updateWebview: file scheme');
        if (this.configuration.previewOnChange) {
          await evaluateInWebview(this, this.text, fsPath);
        } else {
          // ASYNC: Use fs.promises.readFile instead of fs.readFileSync
          const text = await fs.promises.readFile(fsPath, { encoding: 'utf8' });
          await evaluateInWebview(this, text, fsPath);
        }
        return;
      }
      default: {
        debug(`[PREVIEW] updateWebview: default scheme (${scheme})`);
        // Non-file/virtual schemes (vscode-remote, git, vscode-userdata, etc.)
        // Safe Mode should still render using document text.
        let text = this.text;
        if (!this.configuration.previewOnChange) {
          try {
            const bytes = await vscode.workspace.fs.readFile(uri);
            text = new TextDecoder().decode(bytes);
          } catch {
            // Fall back to in-memory text if readFile isn't supported
            text = this.text;
          }
        }
        await evaluateInWebview(this, text, fsPath);
        return;
      }
    }
  }

  async refreshWebview(): Promise<void> {
    debug('[PREVIEW] refreshWebview called');
    const currentPreview = PreviewManager.getInstance().getCurrentPreview();
    if (currentPreview) {
      refreshPanel(currentPreview);
      await this.updateWebview();
    }
  }

  async handleDidChangeTextDocument(
    fsPath: string,
    doc: vscode.TextDocument
  ): Promise<void> {
    if (this.active) {
      if (this.configuration.previewOnChange) {
        if (this.dependentFsPaths.has(fsPath)) {
          this.editingDoc = doc;
          if (fsPath !== this.fsPath) {
            await this.webviewHandle.invalidate(fsPath);
            await this.updateWebview();
          } else {
            await this.updateWebview();
          }
        }
      }
    }
  }

  async handleDidSaveTextDocument(fsPath: string): Promise<void> {
    if (this.active) {
      if (this.dependentFsPaths.has(fsPath)) {
        if (fsPath !== this.fsPath) {
          await this.webviewHandle.invalidate(fsPath);
          await this.updateWebview();
        } else {
          await this.updateWebview();
        }
      }
    }
  }

  updateConfiguration(): void {
    const extensionConfig = vscode.workspace.getConfiguration(
      'mdx-preview',
      this.doc.uri
    );
    const previewOnChange = extensionConfig.get<boolean>(
      'preview.previewOnChange',
      true
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
    const securityPolicy = extensionConfig.get<SecurityPolicy>(
      'preview.security',
      SecurityPolicy.Strict
    );

    const needsWebviewRefresh =
      useVscodeMarkdownStyles !== this.configuration.useVscodeMarkdownStyles ||
      useWhiteBackground !== this.configuration.useWhiteBackground ||
      customLayoutFilePath !== this.configuration.customLayoutFilePath ||
      securityPolicy !== this.configuration.securityPolicy;

    Object.assign(this.configuration, {
      previewOnChange,
      useSucraseTranspiler,
      useVscodeMarkdownStyles,
      useWhiteBackground,
      customLayoutFilePath,
      securityPolicy,
    });

    if (needsWebviewRefresh) {
      // Fire and forget - don't block on refresh
      this.refreshWebview().catch((err) =>
        logError('Failed to refresh preview', err)
      );
    }
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
  await currentPreview.updateWebview();
  debug('[PREVIEW] refreshPreview complete');
}
