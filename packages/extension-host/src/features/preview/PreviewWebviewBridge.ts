// packages/extension-host/src/features/preview/PreviewWebviewBridge.ts
// webview communication & theme management for preview instances

import * as vscode from 'vscode';
import { createTaggedLogger } from '../../shared/logging/logger';
import { LogTags } from '@mdx-preview/contracts';

// module-level tagged logger
const log = createTaggedLogger(LogTags.PREVIEW);
import { getThemeManager } from '../../app/services';
import { resolveMermaidIconPacks } from '../themes/IconPackResolver';
import type { DocumentTracker } from './watchers/DocumentTracker';
import type { CustomCssWatcher } from './watchers/CustomCssWatcher';
import type { WatcherManager } from './watchers/WatcherManager';
import type { WebviewHandleType } from '../../platform/rpc/extension-endpoint';
import type {
  MermaidIconPackSetting,
  PreviewRuntimeConfig,
  WebviewThemeState,
} from '@mdx-preview/contracts';

export type WebviewHandle = WebviewHandleType;

// manage webview communication & theme state for a preview instance
export class PreviewWebviewBridge {
  private webviewHandle?: WebviewHandle;
  private webview?: vscode.Webview;
  private themeRequestSeq = 0;
  private lastSentState = new Map<string, unknown>();

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
    this.themeRequestSeq += 1;
    this.resetLastSentState();
    this.webviewHandle = this.createDeltaHandle(handle);
    const docTracker = watcherManager.get<DocumentTracker>('document');
    docTracker?.setNotifier(handle);
    const cssWatcher = watcherManager.get<CustomCssWatcher>('customCss');
    cssWatcher?.setNotifier(handle);
  }

  // called after webview handshake completes to push initial configuration
  onWebviewReady(docUri: vscode.Uri): void {
    log.debug('onWebviewReady - pushing initial config');
    this.resetLastSentState();
    this.pushThemeState(docUri);
  }

  // push theme state to webview (public for theme refresh w/out full webview refresh)
  pushThemeState(
    docUri: vscode.Uri,
    frontmatter?: Record<string, unknown>
  ): void {
    const webviewHandle = this.webviewHandle;
    if (!webviewHandle) {
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
    const requestId = ++this.themeRequestSeq;
    void this.pushThemeStateWithIconPacks(
      themeState,
      iconPackConfig,
      docUri,
      requestId,
      webviewHandle
    );
  }

  // resolve icon pack files & send the final theme state to the webview
  private async pushThemeStateWithIconPacks(
    themeState: WebviewThemeState,
    iconPackConfig: MermaidIconPackSetting[],
    docUri: vscode.Uri,
    requestId: number,
    webviewHandle: WebviewHandle
  ): Promise<void> {
    const mermaidIconPacks = await resolveMermaidIconPacks(
      iconPackConfig,
      docUri
    );
    const finalState: WebviewThemeState = { ...themeState, mermaidIconPacks };

    if (
      requestId !== this.themeRequestSeq ||
      webviewHandle !== this.webviewHandle
    ) {
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
    webviewHandle.setTheme(finalState);
  }

  pushRuntimeConfiguration(runtimeConfig: PreviewRuntimeConfig): void {
    if (!this.webviewHandle) {
      return;
    }

    this.webviewHandle.setRuntimeConfig(runtimeConfig);
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

  invalidateThemeRequests(): void {
    this.themeRequestSeq += 1;
  }

  dispose(): void {
    this.invalidateThemeRequests();
    this.resetLastSentState();
    this.webviewHandle = undefined;
    this.webview = undefined;
  }

  // suppress unchanged single-value RPC state within one webview handshake
  private createDeltaHandle(handle: WebviewHandle): WebviewHandle {
    const deltaMethods = new Set([
      'setTrustState',
      'setFramework',
      'setTailwindCss',
      'setTailwindBrowserCss',
      'setTheme',
      'setRuntimeConfig',
    ]);

    return new Proxy(handle, {
      get: (target, property) => {
        const value = Reflect.get(target, property, target);
        if (
          typeof property !== 'string' ||
          !deltaMethods.has(property) ||
          typeof value !== 'function'
        ) {
          return value;
        }

        return (nextValue: unknown) => {
          if (
            this.lastSentState.has(property) &&
            this.isSameSentValue(
              property,
              this.lastSentState.get(property),
              nextValue
            )
          ) {
            return undefined;
          }
          this.lastSentState.set(property, nextValue);
          return Reflect.apply(value, target, [nextValue]);
        };
      },
    });
  }

  private isSameSentValue(
    property: string,
    previous: unknown,
    next: unknown
  ): boolean {
    if (property !== 'setTheme') {
      if (
        previous !== null &&
        next !== null &&
        typeof previous === 'object' &&
        typeof next === 'object'
      ) {
        return JSON.stringify(previous) === JSON.stringify(next);
      }
      return Object.is(previous, next);
    }

    const previousTheme = previous as WebviewThemeState;
    const nextTheme = next as WebviewThemeState;
    return (
      previousTheme.previewTheme === nextTheme.previewTheme &&
      previousTheme.codeBlockTheme === nextTheme.codeBlockTheme &&
      previousTheme.mermaidTheme === nextTheme.mermaidTheme &&
      previousTheme.isLight === nextTheme.isLight &&
      previousTheme.plantUmlServer === nextTheme.plantUmlServer &&
      previousTheme.mermaidIconPacks.length ===
        nextTheme.mermaidIconPacks.length &&
      previousTheme.mermaidIconPacks.every((pack, index) => {
        const nextPack = nextTheme.mermaidIconPacks[index];
        return (
          nextPack !== undefined &&
          pack.name === nextPack.name &&
          pack.icons === nextPack.icons
        );
      })
    );
  }

  private resetLastSentState(): void {
    this.lastSentState.clear();
  }
}
