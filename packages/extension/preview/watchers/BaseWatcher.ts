// packages/extension/preview/watchers/BaseWatcher.ts
// abstract base class for all watchers providing common lifecycle management

import * as vscode from 'vscode';
import { debug } from '../../logging';
import {
  disposeCollection as disposeCollectionUtil,
  disposeOne,
} from '../../utils/disposable';
import type { IWatcher } from './types';

// Options for creating a file watcher
interface FileWatcherOptions {
  onChange?: (uri: vscode.Uri) => void;
  onCreate?: (uri: vscode.Uri) => void;
  onDelete?: (uri: vscode.Uri) => void;
  ignoreCreateEvents?: boolean;
  ignoreChangeEvents?: boolean;
  ignoreDeleteEvents?: boolean;
  // wrap handlers in try-catch w/ error logging (default: true)
  wrapErrors?: boolean;
}

// abstract base class for all watchers w/ common lifecycle management
export abstract class BaseWatcher implements IWatcher {
  protected _isActive = false;

  // unique identifier for debug logging (e.g., 'DEP-WATCHER', 'CSS')
  protected abstract readonly logTag: string;

  // Promise-based readiness tracking (replaces polling)
  private _readyPromise: Promise<void> | null = null;
  private _readyResolve: (() => void) | null = null;

  // ─── Lifecycle Methods ─────────────────────────────────────────────

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

  // ─── Update & Restart Pattern ────────────────────────────────────────

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

  // ─── State Query Methods ─────────────────────────────────────────────

  isActive(): boolean {
    return this._isActive;
  }

  // Default: ready when active & checkReadiness() returns true.
  isReady(): boolean {
    return this._isActive && this.checkReadiness();
  }

  // Promise-based waiting for readiness (no polling).
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

  // ─── Abstract Methods (must implement) ─────────────────────────────

  // Called after _isActive is set to true. Setup watchers here.
  protected abstract onStart(): Promise<void> | void;

  // Called before _isActive is set to false. Cleanup watchers here.
  protected abstract onStop(): void;

  // ─── Optional Hooks (override as needed) ───────────────────────────

  // Pre-start validation. Return false to prevent start(). Default: true
  protected canStart(): boolean {
    return true;
  }

  // Additional readiness check beyond _isActive. Default: true
  protected checkReadiness(): boolean {
    return true;
  }

  // Additional cleanup on dispose (beyond stop). Default: no-op
  protected onDispose(): void {}

  // ─── Readiness Signaling ───────────────────────────────────────────

  // Call this from subclasses when readiness state may have changed.
  protected markReady(): void {
    this._checkAndResolveReady();
  }

  // Internal: check & resolve ready promise if conditions are met
  private _checkAndResolveReady(): void {
    if (this._isActive && this.checkReadiness() && this._readyResolve) {
      debug(`[${this.logTag}] Ready`);
      this._readyResolve();
      // prevent double resolve
      this._readyResolve = null;
    }
  }

  // Internal: Get existing promise or create new one.
  private _getOrCreateReadyPromise(): Promise<void> {
    if (!this._readyPromise) {
      this._readyPromise = new Promise((resolve) => {
        this._readyResolve = resolve;
      });
    }
    return this._readyPromise;
  }

  // ─── Helper Methods for Subclasses ─────────────────────────────────

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

  // ─── File Watcher Factory ───────────────────────────────────────────

  // create a file watcher w/ standard event handlers & error wrapping
  protected createFileWatcher(
    pattern: string | vscode.GlobPattern,
    options: FileWatcherOptions = {}
  ): vscode.FileSystemWatcher {
    const {
      wrapErrors = true,
      ignoreCreateEvents = false,
      ignoreChangeEvents = false,
      ignoreDeleteEvents = false,
    } = options;

    const watcher = vscode.workspace.createFileSystemWatcher(
      pattern,
      ignoreCreateEvents,
      ignoreChangeEvents,
      ignoreDeleteEvents
    );

    // helper to wrap handler w/ error handling
    const wrap = (
      handler: ((uri: vscode.Uri) => void) | undefined,
      eventType: string
    ): ((uri: vscode.Uri) => void) | undefined => {
      if (!handler) {
        return undefined;
      }
      if (!wrapErrors) {
        return handler;
      }
      return (uri: vscode.Uri) => {
        try {
          handler(uri);
        } catch (error) {
          debug(`[${this.logTag}] Error in ${eventType} handler: ${error}`);
        }
      };
    };

    const onChange = wrap(options.onChange, 'change');
    const onCreate = wrap(options.onCreate, 'create');
    const onDelete = wrap(options.onDelete, 'delete');

    if (onChange) {
      watcher.onDidChange(onChange);
    }
    if (onCreate) {
      watcher.onDidCreate(onCreate);
    }
    if (onDelete) {
      watcher.onDidDelete(onDelete);
    }

    return watcher;
  }
}
