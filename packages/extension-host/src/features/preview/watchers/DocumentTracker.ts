// packages/extension-host/src/features/preview/watchers/DocumentTracker.ts
// track document versions & stale state for preview updates

import type { WebviewRPC } from '@mdx-preview/contracts';
import type { IWatcher } from '../types/watcher';

// webview handle w/ setStale method
type StaleNotifier = Pick<WebviewRPC, 'setStale'>;

// track document version & stale state (implement IWatcher directly, no file watching)
export class DocumentTracker implements IWatcher {
  private _isActive = true;
  private lastRenderedDocumentUri?: string;
  private lastRenderedVersion = -1;
  private _isStale = false;
  private notifier?: StaleNotifier;

  // set notifier for stale state changes (webview handle)
  setNotifier(notifier: StaleNotifier): void {
    this.notifier = notifier;
  }

  // check if current version is stale (needs re-render)
  isStale(): boolean {
    return this._isStale;
  }

  // check if version has already been rendered
  hasRenderedVersion(documentUri: string, version: number): boolean {
    return (
      documentUri === this.lastRenderedDocumentUri &&
      version === this.lastRenderedVersion
    );
  }

  // mark document as stale (changed but not rendered)
  markStale(): void {
    if (!this._isStale) {
      this._isStale = true;
      this.notifier?.setStale?.(true);
    }
  }

  // mark current version as rendered (no longer stale)
  markRendered(documentUri: string, version: number): void {
    this.lastRenderedDocumentUri = documentUri;
    this.lastRenderedVersion = version;
    if (this._isStale) {
      this._isStale = false;
      this.notifier?.setStale?.(false);
    }
  }

  // reset rendered version (force re-render on next update)
  resetRenderedVersion(): void {
    this.lastRenderedDocumentUri = undefined;
    this.lastRenderedVersion = -1;
  }

  // IWatcher lifecycle methods

  async start(): Promise<void> {
    this._isActive = true;
  }

  stop(): void {
    this._isActive = false;
  }

  isActive(): boolean {
    return this._isActive;
  }

  isReady(): boolean {
    return this._isActive;
  }

  async waitForReady(): Promise<void> {
    return Promise.resolve();
  }

  dispose(): void {
    this._isActive = false;
    this.notifier = undefined;
  }
}
