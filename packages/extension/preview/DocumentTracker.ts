// packages/extension/preview/DocumentTracker.ts
// track document versions & stale state for preview updates

import type { WebviewRPC } from '@mdx-preview/shared-types';

// webview handle w/ setStale method
type StaleNotifier = Pick<WebviewRPC, 'setStale'>;

// track document version & stale state
export class DocumentTracker {
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
  hasRenderedVersion(version: number): boolean {
    return version === this.lastRenderedVersion;
  }

  // mark document as stale (changed but not rendered)
  markStale(): void {
    if (!this._isStale) {
      this._isStale = true;
      this.notifier?.setStale?.(true);
    }
  }

  // mark current version as rendered (no longer stale)
  markRendered(version: number): void {
    this.lastRenderedVersion = version;
    if (this._isStale) {
      this._isStale = false;
      this.notifier?.setStale?.(false);
    }
  }

  // reset rendered version (force re-render on next update)
  resetRenderedVersion(): void {
    this.lastRenderedVersion = -1;
  }
}
