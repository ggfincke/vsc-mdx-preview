// packages/extension-host/src/features/preview/watchers/CustomCssWatcher.ts
// watch custom CSS file for changes & notify webview

import * as vscode from 'vscode';
import { LogTags } from '@mdx-preview/contracts';
import type { WebviewRPC } from '@mdx-preview/contracts';
import { BaseWatcher } from './BaseWatcher';
import { readFileAsync } from '../../../shared/utils/file-utils';
import { resolvePathWithFallbacks } from '../../../shared/utils/path-utils';
import { createExactFileWatcherPattern } from '../../../shared/utils/createFileWatcher';

// webview handle w/ setCustomCss method
export type CssNotifier = Pick<WebviewRPC, 'setCustomCss'>;

// watch custom CSS file & send updates to webview
export class CustomCssWatcher extends BaseWatcher {
  protected readonly logTag = LogTags.CSS;
  private watcher?: vscode.FileSystemWatcher;
  private resolvedPath: string | null = null;
  private notifier?: CssNotifier;
  private loadRequestId = 0;

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
      void this.loadAndSendCss(this.resolvedPath);
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

    // use createFileWatcher from base class w/ error wrapping
    this.watcher = this.createFileWatcher(
      createExactFileWatcherPattern(this.resolvedPath),
      {
        onChange: () => {
          if (this.resolvedPath) {
            void this.loadAndSendCss(this.resolvedPath);
          }
        },
        onCreate: () => {
          if (this.resolvedPath) {
            void this.loadAndSendCss(this.resolvedPath);
          }
        },
        onDelete: () => {
          this.clearCss();
        },
      }
    );

    // initial load runs after the watcher exists so creation cannot be missed
    await this.loadAndSendCss(this.resolvedPath);

    this.log.debug('Watching custom CSS file');
    // signal ready after setup complete
    this.markReady();
  }

  protected onStop(): void {
    this.loadRequestId += 1;
    this.disposeWatcher(this.watcher);
    this.watcher = undefined;
    this.resolvedPath = null;
    this.notifier = undefined;
  }

  protected checkReadiness(): boolean {
    return this.resolvedPath !== null;
  }

  // resolve CSS path (relative to workspace or absolute)
  private resolvePath(cssPath: string): string | null {
    const documentWorkspace = this.documentDirectory
      ? vscode.workspace.getWorkspaceFolder(
          vscode.Uri.file(this.documentDirectory)
        )
      : undefined;
    return resolvePathWithFallbacks({
      inputPath: cssPath,
      primaryDir:
        documentWorkspace?.uri.fsPath ??
        (this.documentDirectory
          ? undefined
          : this.workspaceFolders?.[0]?.uri.fsPath),
      fallbackDirs: [this.documentDirectory],
    });
  }

  // load CSS file & send to webview
  private async loadAndSendCss(cssPath: string): Promise<void> {
    const requestId = ++this.loadRequestId;
    const cssContent = await readFileAsync(cssPath, 'utf-8', {
      logger: this.log,
      logOnError: true,
    });
    if (requestId !== this.loadRequestId || !this.isActive()) {
      return;
    }
    this.notifier?.setCustomCss(cssContent ?? '');
    if (cssContent !== null) {
      this.log.debug(
        `Loaded custom CSS: ${cssPath} (${cssContent.length} chars)`
      );
    }
  }

  private clearCss(): void {
    this.loadRequestId += 1;
    this.notifier?.setCustomCss('');
  }
}
