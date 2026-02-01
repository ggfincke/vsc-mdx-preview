// packages/extension/preview/watchers/TailwindConfigWatcher.ts
// watch Tailwind config & entry CSS files for changes

import debounce from 'lodash.debounce';
import * as vscode from 'vscode';
import { debug } from '../../logging';
import { CONFIG_WATCHER_DEBOUNCE_MS } from '../../tailwind/constants';
import { BaseWatcher } from './BaseWatcher';
import { LogTags } from '@mdx-preview/shared';

export class TailwindConfigWatcher extends BaseWatcher {
  protected readonly logTag = LogTags.TAILWIND_WATCHER;
  private watchers: vscode.FileSystemWatcher[] = [];
  private _debouncedOnChange: ReturnType<typeof debounce>;
  private pendingChanges = new Set<string>();

  constructor(
    private watchFiles: string[],
    private onChange: (changedPaths: string[]) => void
  ) {
    super();
    this._debouncedOnChange = debounce(() => {
      const changedPaths = Array.from(this.pendingChanges);
      this.pendingChanges.clear();
      if (changedPaths.length === 0) {
        return;
      }
      this.onChange(changedPaths);
    }, CONFIG_WATCHER_DEBOUNCE_MS);
  }

  // use updateAndRestartSync pattern from base class
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
      debug(`[${LogTags.TAILWIND_WATCHER}] Creating watcher for: ${file}`);
      // use createFileWatcher from base class w/ error wrapping
      const watcher = this.createFileWatcher(file, {
        onChange: (uri) => {
          debug(`[${LogTags.TAILWIND_WATCHER}] File changed: ${uri.fsPath}`);
          this.queueChange(uri.fsPath);
        },
        onCreate: (uri) => {
          debug(`[${LogTags.TAILWIND_WATCHER}] File created: ${uri.fsPath}`);
          this.queueChange(uri.fsPath);
        },
        onDelete: (uri) => {
          debug(`[${LogTags.TAILWIND_WATCHER}] File deleted: ${uri.fsPath}`);
          this.queueChange(uri.fsPath);
        },
        wrapErrors: true,
      });
      this.watchers.push(watcher);
    }
    debug(
      `[${LogTags.TAILWIND_WATCHER}] Watching ${this.watchFiles.length} file(s)`
    );
  }

  protected onStop(): void {
    this._debouncedOnChange.cancel();
    this.pendingChanges.clear();
    this.disposeCollection(this.watchers);
  }

  private queueChange(fsPath: string): void {
    this.pendingChanges.add(fsPath);
    this._debouncedOnChange();
  }
}
