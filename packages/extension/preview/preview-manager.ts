// packages/extension/preview/preview-manager.ts
// preview manager singleton for managing all preview instances

import * as vscode from 'vscode';
import { debug } from '../logging';
import { LogTags } from '@mdx-preview/shared';
import { SingletonService } from '../services/SingletonService';
import { SubscriberManager } from '../utils/SubscriberManager';

// Import Preview class for type usage
import type { Preview } from './Preview';

// Re-export types & classes
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
export class PreviewManager extends SingletonService<PreviewManager> {
  protected static override instance: PreviewManager | undefined;
  protected readonly logTag = LogTags.PREVIEW_MANAGER;

  private currentPreview: Preview | undefined;
  private subscriberManager = new SubscriberManager<void>(
    LogTags.PREVIEW_MANAGER
  );

  // panel state (moved from webview-manager.ts module-level for better testability)
  private _panel: vscode.WebviewPanel | undefined;
  private _panelDoc: vscode.TextDocument | undefined;
  private _panelDisposables: vscode.Disposable[] = [];

  // webview URI state (moved from webview-manager.ts for lifecycle management)
  private _webviewAppUris: WebviewAppUris | undefined;
  private _extensionUri: vscode.Uri | undefined;

  protected constructor() {
    super();
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
    return this.subscriberManager.subscribe(callback);
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
  private notifySubscribers(): void {
    this.subscriberManager.notify(undefined);
  }

  // custom cleanup - clear panel, preview, & subscribers
  protected override onDispose(): void {
    this.clearPanel();
    this.currentPreview?.dispose();
    this.currentPreview = undefined;
    this.subscriberManager.clear();
  }
}

// get current preview through manager
export function getCurrentPreview(): Preview | undefined {
  debug(`[${LogTags.PREVIEW_MANAGER}] getCurrentPreview called`);
  return PreviewManager.getInstance().getCurrentPreview();
}
