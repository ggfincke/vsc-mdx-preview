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

  // Use updateAndRestartSync pattern from base class
  setWatchFiles(files: string[]): void {
    this.updateAndRestartSync(() => {
      this.watchFiles = files;
    });
  }

  protected canStart(): boolean {
    return this.watchFiles.length > 0;
  }

  protected onStart(): void {
    for (const file of this.watchFiles) {
      debug(`[TAILWIND-WATCHER] Creating watcher for: ${file}`);
      // use createFileWatcher from base class w/ error wrapping
      const watcher = this.createFileWatcher(file, {
        onChange: () => {
          debug(`[TAILWIND-WATCHER] File changed: ${file}`);
          this._debouncedOnChange();
        },
        onCreate: () => {
          debug(`[TAILWIND-WATCHER] File created: ${file}`);
          this._debouncedOnChange();
        },
        onDelete: () => {
          debug(`[TAILWIND-WATCHER] File deleted: ${file}`);
          this._debouncedOnChange();
        },
        wrapErrors: true,
      });
      this.watchers.push(watcher);
    }
    debug(`[TAILWIND-WATCHER] Watching ${this.watchFiles.length} file(s)`);
  }

  protected onStop(): void {
    this._debouncedOnChange.cancel();
    this.disposeCollection(this.watchers);
  }
}
