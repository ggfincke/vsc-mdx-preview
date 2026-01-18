// packages/extension/preview/watchers/BaseWatcher.ts
// abstract base class for all watchers providing common lifecycle management

import * as vscode from 'vscode';
import { debug } from '../../logging';
import type { IWatcher } from './types';

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

    // With timeout - race between ready and timeout
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

  // Internal: Check and resolve ready promise if conditions are met.
  private _checkAndResolveReady(): void {
    if (this._isActive && this.checkReadiness() && this._readyResolve) {
      debug(`[${this.logTag}] Ready`);
      this._readyResolve();
      this._readyResolve = null; // Prevent double resolve
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

  // Dispose a single watcher safely.
  protected disposeWatcher(
    watcher: vscode.FileSystemWatcher | undefined
  ): void {
    watcher?.dispose();
  }

  // Dispose all watchers in an array & clear it.
  protected disposeWatcherArray(watchers: vscode.FileSystemWatcher[]): void {
    for (const watcher of watchers) {
      watcher.dispose();
    }
    watchers.length = 0;
  }

  // Dispose all watchers in a Map & clear it.
  protected disposeWatcherMap(
    watchers: Map<string, vscode.FileSystemWatcher>
  ): void {
    for (const watcher of watchers.values()) {
      watcher.dispose();
    }
    watchers.clear();
  }

  // Dispose all items in a disposables array & clear it.
  protected disposeAll(disposables: vscode.Disposable[]): void {
    for (const d of disposables) {
      d.dispose();
    }
    disposables.length = 0;
  }

  // ─── File Watcher Factory ───────────────────────────────────────────

  // Helper for creating file watchers with standard event handlers.
  // Returns a configured FileSystemWatcher.
  protected createFileWatcher(
    pattern: string | vscode.GlobPattern,
    options: {
      onChange?: (uri: vscode.Uri) => void;
      onCreate?: (uri: vscode.Uri) => void;
      onDelete?: (uri: vscode.Uri) => void;
      ignoreCreateEvents?: boolean;
      ignoreChangeEvents?: boolean;
      ignoreDeleteEvents?: boolean;
    } = {}
  ): vscode.FileSystemWatcher {
    const watcher = vscode.workspace.createFileSystemWatcher(
      pattern,
      options.ignoreCreateEvents ?? false,
      options.ignoreChangeEvents ?? false,
      options.ignoreDeleteEvents ?? false
    );

    if (options.onChange) {
      watcher.onDidChange(options.onChange);
    }
    if (options.onCreate) {
      watcher.onDidCreate(options.onCreate);
    }
    if (options.onDelete) {
      watcher.onDidDelete(options.onDelete);
    }

    return watcher;
  }
}
