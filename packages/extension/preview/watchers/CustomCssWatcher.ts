// packages/extension/preview/watchers/CustomCssWatcher.ts
// watch custom CSS file for changes & notify webview

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { debug } from '../../logging';
import type { WebviewRPC } from '@mdx-preview/shared-types';

// webview handle w/ setCustomCss method
type CssNotifier = Pick<WebviewRPC, 'setCustomCss'>;

// watch custom CSS file & send updates to webview
export class CustomCssWatcher {
  private watcher?: vscode.FileSystemWatcher;
  private disposables: vscode.Disposable[] = [];
  private resolvedPath: string | null = null;
  private notifier?: CssNotifier;

  constructor(
    private cssPath: string,
    private workspaceFolders: readonly vscode.WorkspaceFolder[] | undefined,
    private documentDirectory: string | null
  ) {}

  // set notifier for CSS updates (webview handle)
  setNotifier(notifier: CssNotifier): void {
    this.notifier = notifier;
    // send initial CSS if already loaded
    if (this.resolvedPath) {
      this.loadAndSendCss(this.resolvedPath);
    }
  }

  // start watching the CSS file
  watch(): void {
    if (!this.cssPath) {
      return;
    }

    this.resolvedPath = this.resolvePath(this.cssPath);
    if (!this.resolvedPath) {
      return;
    }

    // initial load
    this.loadAndSendCss(this.resolvedPath);

    // watch for changes
    this.watcher = vscode.workspace.createFileSystemWatcher(this.resolvedPath);

    this.disposables.push(
      this.watcher.onDidChange(() => {
        debug('[CSS] Custom CSS file changed');
        if (this.resolvedPath) {
          this.loadAndSendCss(this.resolvedPath);
        }
      }),
      this.watcher.onDidCreate(() => {
        debug('[CSS] Custom CSS file created');
        if (this.resolvedPath) {
          this.loadAndSendCss(this.resolvedPath);
        }
      }),
      this.watcher.onDidDelete(() => {
        debug('[CSS] Custom CSS file deleted');
        this.notifier?.setCustomCss?.('');
      }),
      this.watcher
    );
  }

  // resolve CSS path (relative to workspace or absolute)
  private resolvePath(cssPath: string): string | null {
    if (path.isAbsolute(cssPath)) {
      return cssPath;
    }

    // try relative to workspace root
    if (this.workspaceFolders && this.workspaceFolders.length > 0) {
      return path.join(this.workspaceFolders[0].uri.fsPath, cssPath);
    }

    // try relative to document
    if (this.documentDirectory) {
      return path.join(this.documentDirectory, cssPath);
    }

    return null;
  }

  // load CSS file & send to webview
  private async loadAndSendCss(cssPath: string): Promise<void> {
    try {
      const cssContent = await fs.promises.readFile(cssPath, 'utf-8');
      this.notifier?.setCustomCss?.(cssContent);
      debug(`[CSS] Loaded custom CSS: ${cssPath} (${cssContent.length} chars)`);
    } catch (err) {
      debug(`[CSS] Failed to load custom CSS: ${err}`);
      // silently fail - file might not exist yet
    }
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

  // dispose all resources
  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
    this.watcher = undefined;
    this.resolvedPath = null;
  }
}
