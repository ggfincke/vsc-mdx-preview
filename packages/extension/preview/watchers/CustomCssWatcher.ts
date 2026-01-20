// packages/extension/preview/watchers/CustomCssWatcher.ts
// watch custom CSS file for changes & notify webview

import * as vscode from 'vscode';
import { debug } from '../../logging';
import type { WebviewRPC } from '@mdx-preview/shared';
import { BaseWatcher } from './BaseWatcher';
import { readFileAsync } from '../../utils/file-utils';
import { resolvePathWithFallbacks } from '../../utils/path-utils';

// webview handle w/ setCustomCss method
type CssNotifier = Pick<WebviewRPC, 'setCustomCss'>;

// watch custom CSS file & send updates to webview
export class CustomCssWatcher extends BaseWatcher {
  protected readonly logTag = 'CSS';
  private watcher?: vscode.FileSystemWatcher;
  private resolvedPath: string | null = null;
  private notifier?: CssNotifier;

  constructor(
    private cssPath: string,
    private workspaceFolders: readonly vscode.WorkspaceFolder[] | undefined,
    private documentDirectory: string | null
  ) {
    super();
  }

  // set notifier for CSS updates (webview handle)
  setNotifier(notifier: CssNotifier): void {
    this.notifier = notifier;
    // send initial CSS if already loaded
    if (this.resolvedPath) {
      this.loadAndSendCss(this.resolvedPath);
    }
  }

  protected canStart(): boolean {
    if (!this.cssPath) {
      return false;
    }
    this.resolvedPath = this.resolvePath(this.cssPath);
    return this.resolvedPath !== null;
  }

  protected async onStart(): Promise<void> {
    if (!this.resolvedPath) {
      return;
    }

    // initial load
    await this.loadAndSendCss(this.resolvedPath);

    // Use createFileWatcher from base class with error wrapping
    this.watcher = this.createFileWatcher(this.resolvedPath, {
      onChange: () => {
        debug('[CSS] Custom CSS file changed');
        if (this.resolvedPath) {
          this.loadAndSendCss(this.resolvedPath);
        }
      },
      onCreate: () => {
        debug('[CSS] Custom CSS file created');
        if (this.resolvedPath) {
          this.loadAndSendCss(this.resolvedPath);
        }
      },
      onDelete: () => {
        debug('[CSS] Custom CSS file deleted');
        this.notifier?.setCustomCss?.('');
      },
      wrapErrors: true,
    });

    debug('[CSS] Watching custom CSS file');
    this.markReady(); // Signal ready after setup complete
  }

  protected onStop(): void {
    this.disposeWatcher(this.watcher);
    this.watcher = undefined;
    this.resolvedPath = null;
  }

  protected checkReadiness(): boolean {
    return this.resolvedPath !== null;
  }

  // Alias for backward compatibility
  watch(): void {
    this.start();
  }

  // resolve CSS path (relative to workspace or absolute)
  private resolvePath(cssPath: string): string | null {
    return resolvePathWithFallbacks({
      inputPath: cssPath,
      primaryDir: this.workspaceFolders?.[0]?.uri.fsPath,
      fallbackDirs: [this.documentDirectory],
    });
  }

  // load CSS file & send to webview
  private async loadAndSendCss(cssPath: string): Promise<void> {
    const cssContent = await readFileAsync(cssPath, 'utf-8', {
      logTag: '[CSS]',
      logOnError: true,
    });
    if (cssContent) {
      this.notifier?.setCustomCss?.(cssContent);
      debug(`[CSS] Loaded custom CSS: ${cssPath} (${cssContent.length} chars)`);
    }
    // silently fail if null - file might not exist yet
  }

  // update CSS path & restart watching
  updatePath(
    cssPath: string,
    workspaceFolders: readonly vscode.WorkspaceFolder[] | undefined,
    documentDirectory: string | null
  ): void {
    this.dispose();
    this.cssPath = cssPath;
    this.workspaceFolders = workspaceFolders;
    this.documentDirectory = documentDirectory;
    this.watch();
  }
}
