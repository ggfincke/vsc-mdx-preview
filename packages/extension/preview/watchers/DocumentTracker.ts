// packages/extension/preview/watchers/DocumentTracker.ts
// track document versions & stale state for preview updates

import { LogTags, type WebviewRPC } from '@mdx-preview/shared';
import { BaseWatcher } from './BaseWatcher';

// webview handle w/ setStale method
type StaleNotifier = Pick<WebviewRPC, 'setStale'>;

// track document version & stale state
// extends BaseWatcher for consistency, though start/stop are no-ops
// since this is a state tracker rather than a file watcher
export class DocumentTracker extends BaseWatcher {
  protected readonly logTag = LogTags.DOC_TRACKER;

  private lastRenderedVersion = -1;
  private _isStale = false;
  private notifier?: StaleNotifier;

  constructor() {
    super();
    // state trackers start active by default
    this._isActive = true;
  }

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

  // BaseWatcher abstract methods (no-ops for state tracker)
  protected onStart(): void {}
  protected onStop(): void {}

  // custom cleanup - clear notifier
  protected override onDispose(): void {
    this.notifier = undefined;
  }
}
