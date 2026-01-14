// packages/extension/preview/watchers/TailwindConfigWatcher.ts
// Watch Tailwind config & entry CSS files for changes
//
// Error Handling Strategy:
// - Try/catch around all watcher callbacks to prevent silent failures
// - Debug logging for watcher lifecycle events
// - Note: VS Code's FileSystemWatcher does not expose an error event;
//   errors in glob patterns or filesystem access are handled internally by VS Code

import debounce from 'lodash.debounce';
import * as vscode from 'vscode';
import { debug } from '../../logging';
import { CONFIG_WATCHER_DEBOUNCE_MS } from '../../tailwind/constants';
import type { IWatcher } from './types';

export class TailwindConfigWatcher implements IWatcher {
  private watchers: vscode.FileSystemWatcher[] = [];
  private _isActive = false;
  private _debouncedOnChange: ReturnType<typeof debounce>;

  constructor(
    private watchFiles: string[],
    onChange: () => void
  ) {
    this._debouncedOnChange = debounce(onChange, CONFIG_WATCHER_DEBOUNCE_MS);
  }

  setWatchFiles(files: string[]): void {
    const wasActive = this._isActive;
    if (wasActive) {
      this.stop();
    }
    this.watchFiles = files;
    if (wasActive) {
      this.start();
    }
  }

  async start(): Promise<void> {
    if (this._isActive || this.watchFiles.length === 0) {
      return;
    }

    this._isActive = true;

    for (const file of this.watchFiles) {
      debug(`[TAILWIND-WATCHER] Creating watcher for: ${file}`);
      const watcher = vscode.workspace.createFileSystemWatcher(file);
      watcher.onDidChange(() => {
        try {
          debug(`[TAILWIND-WATCHER] File changed: ${file}`);
          this._debouncedOnChange();
        } catch (error) {
          debug(`[TAILWIND-WATCHER] Error in change callback: ${error}`);
        }
      });
      watcher.onDidCreate(() => {
        try {
          debug(`[TAILWIND-WATCHER] File created: ${file}`);
          this._debouncedOnChange();
        } catch (error) {
          debug(`[TAILWIND-WATCHER] Error in create callback: ${error}`);
        }
      });
      watcher.onDidDelete(() => {
        try {
          debug(`[TAILWIND-WATCHER] File deleted: ${file}`);
          this._debouncedOnChange();
        } catch (error) {
          debug(`[TAILWIND-WATCHER] Error in delete callback: ${error}`);
        }
      });
      this.watchers.push(watcher);
    }

    debug(
      `[TAILWIND-WATCHER] Started watching ${this.watchFiles.length} file(s)`
    );
  }

  stop(): void {
    if (!this._isActive) {
      return;
    }

    this._isActive = false;
    this._debouncedOnChange.cancel();
    for (const watcher of this.watchers) {
      watcher.dispose();
    }
    this.watchers = [];
    debug('[TAILWIND-WATCHER] Stopped');
  }

  isActive(): boolean {
    return this._isActive;
  }

  isReady(): boolean {
    // ready when active (synchronous watcher)
    return this._isActive;
  }

  dispose(): void {
    this.stop();
  }
}
