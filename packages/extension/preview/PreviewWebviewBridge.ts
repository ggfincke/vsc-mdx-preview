// packages/extension/preview/PreviewWebviewBridge.ts
// * Webview communication & theme management for preview instances

import * as vscode from 'vscode';
import { debug } from '../logging';
import { getThemeManager } from '../services';
import { DocumentTracker, CustomCssWatcher, WatcherManager } from './watchers';
import type { WebviewHandleType } from '../rpc-extension';

export type WebviewHandle = WebviewHandleType;

// manages webview communication & theme state for a preview instance
// handles the bridge between the extension & webview for theme updates & handle setup
export class PreviewWebviewBridge {
  private webviewHandle?: WebviewHandle;
  private webview?: vscode.Webview;

  // get a webview URI for a file system path
  getWebviewUri(fsPath: string): string | undefined {
    if (!this.webview) {
      return undefined;
    }
    return this.webview.asWebviewUri(vscode.Uri.file(fsPath)).toString();
  }

  // set the webview instance for URI conversion
  setWebview(webview: vscode.Webview): void {
    this.webview = webview;
  }

  // get the current webview handle
  getHandle(): WebviewHandle | undefined {
    return this.webviewHandle;
  }

  // set the webview handle & connect it to watchers that need notification capability
  setWebviewHandle(
    handle: WebviewHandle,
    watcherManager: WatcherManager
  ): void {
    this.webviewHandle = handle;
    const docTracker = watcherManager.get<DocumentTracker>('document');
    docTracker?.setNotifier(handle);
    const cssWatcher = watcherManager.get<CustomCssWatcher>('customCss');
    cssWatcher?.setNotifier(handle);
  }

  // called after webview handshake completes to push initial configuration
  onWebviewReady(docUri: vscode.Uri): void {
    debug('[PREVIEW] onWebviewReady - pushing initial config');
    this.pushThemeState(docUri);
  }

  // push theme state to webview (public for theme refresh w/out full webview refresh)
  pushThemeState(
    docUri: vscode.Uri,
    frontmatter?: Record<string, unknown>
  ): void {
    if (!this.webviewHandle) {
      return;
    }
    const themeManager = getThemeManager();
    let themeState = themeManager.getWebviewThemeState(docUri);

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

  // invalidate a module in the webview cache
  async invalidate(fsPath: string): Promise<void> {
    if (this.webviewHandle) {
      await this.webviewHandle.invalidate(fsPath);
    }
  }
}
