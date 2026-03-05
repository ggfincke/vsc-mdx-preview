// packages/extension-host/src/features/preview/watchers/CustomCssWatcher.ts
// watch custom CSS file for changes & notify webview

import * as vscode from 'vscode';
import { LogTags } from '@mdx-preview/contracts';
import type { WebviewRPC } from '@mdx-preview/contracts';
import { BaseWatcher } from './BaseWatcher';
import { readFileAsync } from '../../../shared/utils/file-utils';
import { resolvePathWithFallbacks } from '../../../shared/utils/path-utils';

// webview handle w/ setCustomCss method
type CssNotifier = Pick<WebviewRPC, 'setCustomCss'>;

// watch custom CSS file & send updates to webview
export class CustomCssWatcher extends BaseWatcher {
  protected readonly logTag = LogTags.CSS;
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

    // use createFileWatcher from base class w/ error wrapping
    this.watcher = this.createFileWatcher(this.resolvedPath, {
      onChange: () => {
        if (this.resolvedPath) {
          this.loadAndSendCss(this.resolvedPath);
        }
      },
      onCreate: () => {
        if (this.resolvedPath) {
          this.loadAndSendCss(this.resolvedPath);
        }
      },
      onDelete: () => {
        this.notifier?.setCustomCss?.('');
      },
      wrapErrors: true,
    });

    this.log.debug('Watching custom CSS file');
    // signal ready after setup complete
    this.markReady();
  }

  protected onStop(): void {
    this.disposeWatcher(this.watcher);
    this.watcher = undefined;
    this.resolvedPath = null;
  }

  protected checkReadiness(): boolean {
    return this.resolvedPath !== null;
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
      logger: this.log,
      logOnError: true,
    });
    if (cssContent) {
      this.notifier?.setCustomCss?.(cssContent);
      this.log.debug(
        `Loaded custom CSS: ${cssPath} (${cssContent.length} chars)`
      );
    }
    // silently fail if null - file might not exist yet
  }
}
