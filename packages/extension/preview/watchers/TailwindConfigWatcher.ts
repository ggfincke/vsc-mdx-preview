// packages/extension/preview/watchers/TailwindConfigWatcher.ts
// watch Tailwind config & entry CSS files for changes

import debounce from 'lodash.debounce';
import * as vscode from 'vscode';
import { debug } from '../../logging';
import { CONFIG_WATCHER_DEBOUNCE_MS } from '../../tailwind/constants';
import { BaseWatcher } from './BaseWatcher';

export class TailwindConfigWatcher extends BaseWatcher {
  protected readonly logTag = 'TAILWIND-WATCHER';
  private watchers: vscode.FileSystemWatcher[] = [];
  private _debouncedOnChange: ReturnType<typeof debounce>;

  constructor(
    private watchFiles: string[],
    onChange: () => void
  ) {
    super();
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

  protected canStart(): boolean {
    return this.watchFiles.length > 0;
  }

  protected onStart(): void {
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
    debug(`[TAILWIND-WATCHER] Watching ${this.watchFiles.length} file(s)`);
  }

  protected onStop(): void {
    this._debouncedOnChange.cancel();
    this.disposeWatcherArray(this.watchers);
  }
}
