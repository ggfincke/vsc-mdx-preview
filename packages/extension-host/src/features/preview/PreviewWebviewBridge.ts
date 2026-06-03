// packages/extension-host/src/features/preview/PreviewWebviewBridge.ts
// webview communication & theme management for preview instances

import * as vscode from 'vscode';
import { createTaggedLogger } from '../../shared/logging/logger';
import { LogTags } from '@mdx-preview/contracts';

// module-level tagged logger
const log = createTaggedLogger(LogTags.PREVIEW);
import { getThemeManager } from '../../app/services';
import { resolveMermaidIconPacks } from '../themes/IconPackResolver';
import { DocumentTracker, CustomCssWatcher, WatcherManager } from './watchers';
import type { WebviewHandleType } from '../../platform/rpc/extension-endpoint';
import type { PreviewRuntimeConfig } from '../types';
import type {
  MermaidIconPackSetting,
  WebviewThemeState,
} from '@mdx-preview/contracts';

export type WebviewHandle = WebviewHandleType;

// manage webview communication & theme state for a preview instance
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
    log.debug('onWebviewReady - pushing initial config');
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

    // resolve configured mermaid icon packs (async file reads) then push
    const iconPackConfig =
      themeManager.getThemeConfiguration(docUri).mermaidIconPacks;
    void this.pushThemeStateWithIconPacks(themeState, iconPackConfig, docUri);
  }

  // resolve icon pack files & send the final theme state to the webview
  private async pushThemeStateWithIconPacks(
    themeState: WebviewThemeState,
    iconPackConfig: MermaidIconPackSetting[],
    docUri: vscode.Uri
  ): Promise<void> {
    const mermaidIconPacks = await resolveMermaidIconPacks(
      iconPackConfig,
      docUri
    );
    const finalState: WebviewThemeState = { ...themeState, mermaidIconPacks };

    if (!this.webviewHandle) {
      return;
    }
    // redact pack payloads (may contain file-derived content) from logs
    log.debug('pushThemeState - pushing theme state', {
      ...finalState,
      mermaidIconPacks: finalState.mermaidIconPacks.map((pack) => ({
        name: pack.name,
        iconCount: Object.keys(pack.icons.icons).length,
      })),
    });
    this.webviewHandle.setTheme(finalState);
  }

  pushRuntimeConfiguration(runtimeConfig: PreviewRuntimeConfig): void {
    if (!this.webviewHandle) {
      return;
    }

    this.webviewHandle.setSourceLineHighlight(
      runtimeConfig.sourceLineHighlight
    );
    this.webviewHandle.setSourceLineHighlightColor(
      runtimeConfig.sourceLineHighlightColor
    );
    this.webviewHandle.setScrollSync(runtimeConfig.scrollSync);
    this.webviewHandle.setShimSideRail(runtimeConfig.shimSideRail);
  }

  // invalidate a module in the webview cache
  async invalidate(fsPath: string): Promise<void> {
    if (this.webviewHandle) {
      await this.webviewHandle.invalidate(fsPath);
    }
  }

  // clear all caches in the webview (for manual cache refresh command)
  async clearAllCaches(): Promise<void> {
    if (this.webviewHandle) {
      await this.webviewHandle.clearAllCaches();
    }
  }

  scrollToLine(line: number): void {
    this.webviewHandle?.scrollToLine(line);
  }
}
