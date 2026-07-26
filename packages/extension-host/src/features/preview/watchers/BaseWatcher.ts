// packages/extension-host/src/features/preview/watchers/BaseWatcher.ts
// abstract base class for all watchers w/ common lifecycle management

import debounce from 'lodash.debounce';
import * as vscode from 'vscode';
import { createTaggedLogger } from '../../../shared/logging/logger';
import type { TaggedLogger } from '@mdx-preview/contracts';
import {
  disposeCollection as disposeCollectionUtil,
  disposeOne,
} from '../../../shared/utils/disposable';
import {
  createFileWatcher as createFileWatcherUtil,
  type FileWatcherConfig,
} from '../../../shared/utils/createFileWatcher';
import type { IWatcher } from '../types/watcher';
import type { LogTag } from '@mdx-preview/contracts';

// file watcher options for subclasses (omits pattern & logTag, derived from class)
type FileWatcherOptions = Omit<FileWatcherConfig, 'pattern' | 'logTag'>;

// abstract base class for all watchers w/ common lifecycle management
export abstract class BaseWatcher implements IWatcher {
  protected _isActive = false;
  private _debouncedHandlers: ReturnType<typeof debounce>[] = [];

  // use log tag for debug logging (e.g., LogTags.DEP_WATCHER)
  protected abstract readonly logTag: LogTag;

  // lazy-initialized tagged logger (uses subclass logTag)
  private _log?: TaggedLogger;
  protected get log(): TaggedLogger {
    return (this._log ??= createTaggedLogger(this.logTag));
  }

  // promise-based readiness tracking (replaces polling)
  private _readyPromise: Promise<void> | null = null;
  private _readyResolve: (() => void) | null = null;

  // lifecycle methods

  async start(): Promise<void> {
    if (this._isActive) {
      return;
    }

    // allow subclass to validate/prepare before activating
    if (!this.canStart()) {
      return;
    }

    // create fresh ready promise before starting
    this._readyPromise = new Promise((resolve) => {
      this._readyResolve = resolve;
    });

    this._isActive = true;
    await this.onStart();
    this.log.debug('Started');

    // check if already ready after onStart completes
    this._checkAndResolveReady();
  }

  stop(): void {
    if (!this._isActive) {
      return;
    }

    this._isActive = false;

    // cancel all tracked debounced handlers before subclass cleanup
    for (const handler of this._debouncedHandlers) {
      handler.cancel();
    }

    this.onStop();

    // reset ready promise state for potential restart
    this._readyPromise = null;
    this._readyResolve = null;

    this.log.debug('Stopped');
  }

  // update & restart pattern

  // stop (if active), run update function, then restart (if was active)
  protected updateAndRestartSync(updateFn: () => void): void {
    const wasActive = this._isActive;
    if (wasActive) {
      this.stop();
    }
    updateFn();
    if (wasActive) {
      void this.start();
    }
  }

  // state query methods

  isActive(): boolean {
    return this._isActive;
  }

  // default: ready when active & checkReadiness() return true
  isReady(): boolean {
    return this._isActive && this.checkReadiness();
  }

  // promise-based waiting for readiness (no polling)
  async waitForReady(timeoutMs?: number): Promise<void> {
    // if already ready, resolve immediately
    if (this.isReady()) {
      return Promise.resolve();
    }

    // get or create ready promise
    const readyPromise = this._getOrCreateReadyPromise();

    // no timeout - just wait for ready
    if (!timeoutMs) {
      return readyPromise;
    }

    // w/ timeout - race between ready & timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            `[${this.logTag}] Watcher ready timeout after ${timeoutMs}ms`
          )
        );
      }, timeoutMs);
    });

    return Promise.race([readyPromise, timeoutPromise]);
  }

  dispose(): void {
    this.stop();
    this._debouncedHandlers = [];
    this.onDispose();
  }

  // abstract methods (must implement)

  // called after _isActive is set to true - setup watchers here
  protected abstract onStart(): Promise<void> | void;

  // called before _isActive is set to false - cleanup watchers here
  protected abstract onStop(): void;

  // optional hooks (override as needed)

  // pre-start validation - return false to prevent start() (default: true)
  protected canStart(): boolean {
    return true;
  }

  // additional readiness check beyond _isActive (default: true)
  protected checkReadiness(): boolean {
    return true;
  }

  // additional cleanup on dispose (beyond stop) - default: no-op
  protected onDispose(): void {}

  // readiness signaling

  // call this from subclasses when readiness state may have changed
  protected markReady(): void {
    this._checkAndResolveReady();
  }

  // internal: check & resolve ready promise if conditions are met
  private _checkAndResolveReady(): void {
    if (this._isActive && this.checkReadiness() && this._readyResolve) {
      this.log.debug('Ready');
      this._readyResolve();
      // prevent double resolve
      this._readyResolve = null;
    }
  }

  // internal: get existing promise or create new one
  private _getOrCreateReadyPromise(): Promise<void> {
    if (!this._readyPromise) {
      this._readyPromise = new Promise((resolve) => {
        this._readyResolve = resolve;
      });
    }
    return this._readyPromise;
  }

  // helper methods for subclasses

  // create a debounced wrapper that auto-cancels on stop()
  protected createDebouncedHandler<T extends (...args: never[]) => void>(
    fn: T,
    delayMs: number
  ): T & { cancel(): void; flush(): void } {
    const handler = debounce(fn, delayMs);
    this._debouncedHandlers.push(handler);
    return handler as T & { cancel(): void; flush(): void };
  }

  // dispose a single watcher safely
  protected disposeWatcher(
    watcher: vscode.FileSystemWatcher | undefined
  ): void {
    disposeOne(watcher);
  }

  // dispose all items in a collection (Array or Map) & clear it
  protected disposeCollection(
    collection: vscode.Disposable[] | Map<string, vscode.Disposable>
  ): void {
    disposeCollectionUtil(collection);
  }

  // file watcher factory

  // create file watcher w/ standard event handlers & error wrapping
  protected createFileWatcher(
    pattern: string | vscode.GlobPattern,
    options: FileWatcherOptions = {}
  ): vscode.FileSystemWatcher {
    return createFileWatcherUtil({
      pattern,
      logTag: this.logTag,
      enableEventLogging: true,
      ...options,
    });
  }
}
