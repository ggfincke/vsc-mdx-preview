// packages/extension/preview/watchers/BaseWatcher.ts
// abstract base class for all watchers w/ common lifecycle management

import * as vscode from 'vscode';
import { debug } from '../../logging';
import {
  disposeCollection as disposeCollectionUtil,
  disposeOne,
} from '../../utils/disposable';
import {
  createFileWatcher as createFileWatcherUtil,
  type FileWatcherConfig,
} from '../../utils/createFileWatcher';
import type { IWatcher } from './types';

// options for creating a file watcher in BaseWatcher subclasses
// uses the shared FileWatcherConfig but omits pattern (passed separately)
// & logTag (derived from the class's logTag property)
type FileWatcherOptions = Omit<FileWatcherConfig, 'pattern' | 'logTag'>;

// abstract base class for all watchers w/ common lifecycle management
export abstract class BaseWatcher implements IWatcher {
  protected _isActive = false;

  // unique identifier for debug logging (e.g., 'DEP-WATCHER', 'CSS')
  protected abstract readonly logTag: string;

  // Promise-based readiness tracking (replaces polling)
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

    // Create fresh ready promise before starting
    this._readyPromise = new Promise((resolve) => {
      this._readyResolve = resolve;
    });

    this._isActive = true;
    await this.onStart();
    debug(`[${this.logTag}] Started`);

    // Check if already ready after onStart completes
    this._checkAndResolveReady();
  }

  stop(): void {
    if (!this._isActive) {
      return;
    }

    this._isActive = false;
    this.onStop();

    // Reset ready promise state for potential restart
    this._readyPromise = null;
    this._readyResolve = null;

    debug(`[${this.logTag}] Stopped`);
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

  // async version - awaits start() completion
  protected async updateAndRestart(updateFn: () => void): Promise<void> {
    const wasActive = this._isActive;
    if (wasActive) {
      this.stop();
    }
    updateFn();
    if (wasActive) {
      await this.start();
    }
  }

  // state query methods

  isActive(): boolean {
    return this._isActive;
  }

  // default: ready when active & checkReadiness() returns true
  isReady(): boolean {
    return this._isActive && this.checkReadiness();
  }

  // Promise-based waiting for readiness (no polling)
  async waitForReady(timeoutMs?: number): Promise<void> {
    // If already ready, resolve immediately
    if (this.isReady()) {
      return Promise.resolve();
    }

    // Get or create ready promise
    const readyPromise = this._getOrCreateReadyPromise();

    // No timeout - just wait for ready
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
      debug(`[${this.logTag}] Ready`);
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
      ...options,
    });
  }
}
