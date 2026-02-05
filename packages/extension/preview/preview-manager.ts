// packages/extension/preview/preview-manager.ts
// preview manager singleton for managing all preview instances

import * as vscode from 'vscode';
import { createTaggedLogger } from '../logging';
import { LogTags } from '@mdx-preview/shared';
import { WithSubscribers } from '../services/SingletonService';

// module-level tagged logger
const log = createTaggedLogger(LogTags.PREVIEW_MANAGER);

// import Preview class for type usage
import type { Preview } from './Preview';

// re-export types & classes
export {
  Preview,
  type StyleConfiguration,
  type WebviewHandle,
} from './Preview';
export { openPreview, refreshPreview } from './preview-commands';

// webview app URIs (loaded from Vite manifest)
export interface WebviewAppUris {
  mainScript: vscode.Uri;
  mainStyle: vscode.Uri | undefined;
}

// * singleton manager for all preview instances
// manage preview lifecycle, panel state, & subscriber notifications
export class PreviewManager extends WithSubscribers<PreviewManager, void> {
  protected static override instance: PreviewManager | undefined;
  protected readonly logTag = LogTags.PREVIEW_MANAGER;

  private currentPreview: Preview | undefined;

  // panel state (moved from webview-manager.ts module-level for better testability)
  private _panel: vscode.WebviewPanel | undefined;
  private _panelDoc: vscode.TextDocument | undefined;
  private _panelDisposables: vscode.Disposable[] = [];

  // webview URI state (moved from webview-manager.ts for lifecycle management)
  private _webviewAppUris: WebviewAppUris | undefined;
  private _extensionUri: vscode.Uri | undefined;

  protected constructor() {
    super(LogTags.PREVIEW_MANAGER);
  }

  // get current preview
  getCurrentPreview(): Preview | undefined {
    return this.currentPreview;
  }

  // set current preview & notify subscribers
  setCurrentPreview(preview: Preview | undefined): void {
    this.currentPreview = preview;
    this.notifyPreviewSubscribers();
  }

  // refresh all active previews (e.g., when trust state changes)
  async refreshAllPreviews(): Promise<void> {
    if (this.currentPreview?.active) {
      await this.currentPreview.refreshWebview();
    }
  }

  // push theme to all active previews without full refresh
  pushThemeToAllPreviews(): void {
    if (this.currentPreview?.active) {
      this.currentPreview.pushThemeState();
    }
  }

  // clear webview caches for all active previews (via RPC)
  async clearAllWebviewCaches(): Promise<void> {
    if (this.currentPreview?.active) {
      try {
        await this.currentPreview.clearAllCaches();
      } catch (error: unknown) {
        log.debug(
          `Failed to clear webview cache: ${error}`
        );
      }
    }
  }

  // check if there are any active previews
  hasActivePreviews(): boolean {
    return this.currentPreview?.active ?? false;
  }

  // panel state accessors
  getPanel(): vscode.WebviewPanel | undefined {
    return this._panel;
  }

  setPanel(panel: vscode.WebviewPanel | undefined): void {
    this._panel = panel;
  }

  getPanelDoc(): vscode.TextDocument | undefined {
    return this._panelDoc;
  }

  setPanelDoc(doc: vscode.TextDocument | undefined): void {
    this._panelDoc = doc;
  }

  getPanelDisposables(): vscode.Disposable[] {
    return this._panelDisposables;
  }

  // webview URI state accessors
  getWebviewAppUris(): WebviewAppUris | undefined {
    return this._webviewAppUris;
  }

  setWebviewAppUris(uris: WebviewAppUris): void {
    this._webviewAppUris = uris;
  }

  getExtensionUri(): vscode.Uri | undefined {
    return this._extensionUri;
  }

  setExtensionUri(uri: vscode.Uri): void {
    this._extensionUri = uri;
  }

  // clear panel state (called when panel is disposed)
  clearPanel(): void {
    this._panel?.dispose();
    while (this._panelDisposables.length) {
      const disposable = this._panelDisposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
    this._panel = undefined;
    this._panelDoc = undefined;
  }

  // notify subscribers when preview state changes
  private notifyPreviewSubscribers(): void {
    this.notifySubscribers(undefined);
  }

  // custom cleanup - clear panel, preview, & subscribers
  protected override onDispose(): void {
    this.clearPanel();
    this.currentPreview?.dispose();
    this.currentPreview = undefined;
  }
}

// get current preview through manager
export function getCurrentPreview(): Preview | undefined {
  log.debug('getCurrentPreview called');
  return PreviewManager.getInstance().getCurrentPreview();
}
