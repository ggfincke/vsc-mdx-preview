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

  // ─── Lifecycle Methods ─────────────────────────────────────────────

  async start(): Promise<void> {
    if (this._isActive) {
      return;
    }

    // allow subclass to validate/prepare before activating
    if (!this.canStart()) {
      return;
    }

    this._isActive = true;
    await this.onStart();
    debug(`[${this.logTag}] Started`);
  }

  stop(): void {
    if (!this._isActive) {
      return;
    }

    this._isActive = false;
    this.onStop();
    debug(`[${this.logTag}] Stopped`);
  }

  isActive(): boolean {
    return this._isActive;
  }

  // Default: ready when active & checkReadiness() returns true.
  isReady(): boolean {
    return this._isActive && this.checkReadiness();
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

  // ─── Helper Methods for Subclasses ─────────────────────────────────

  // Dispose a single watcher safely.
  protected disposeWatcher(watcher: vscode.FileSystemWatcher | undefined): void {
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
}
