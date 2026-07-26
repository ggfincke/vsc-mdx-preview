// packages/extension-host/src/features/preview/watchers/TailwindConfigWatcher.ts
// watch Tailwind config & entry CSS files for changes

import * as vscode from 'vscode';
import { BaseWatcher } from './BaseWatcher';
import { LogTags, STANDARD_DEBOUNCE_MS } from '@mdx-preview/contracts';
import { createExactFileWatcherPattern } from '../../../shared/utils/createFileWatcher';

export class TailwindConfigWatcher extends BaseWatcher {
  protected readonly logTag = LogTags.TAILWIND_WATCHER;
  private watchers: vscode.FileSystemWatcher[] = [];
  private _debouncedOnChange: (() => void) & {
    cancel(): void;
    flush(): void;
  };
  private pendingChanges = new Set<string>();

  constructor(
    private watchFiles: string[],
    private onChange: (changedPaths: string[]) => void
  ) {
    super();
    this._debouncedOnChange = this.createDebouncedHandler(() => {
      const changedPaths = Array.from(this.pendingChanges);
      this.pendingChanges.clear();
      if (changedPaths.length === 0) {
        return;
      }
      this.onChange(changedPaths);
    }, STANDARD_DEBOUNCE_MS);
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
      this.log.debug(`Creating watcher for: ${file}`);
      // use createFileWatcher from base class w/ error wrapping
      const watcher = this.createFileWatcher(
        createExactFileWatcherPattern(file),
        {
          onChange: (uri) => {
            this.queueChange(uri.fsPath);
          },
          onCreate: (uri) => {
            this.queueChange(uri.fsPath);
          },
          onDelete: (uri) => {
            this.queueChange(uri.fsPath);
          },
        }
      );
      this.watchers.push(watcher);
    }
    this.log.debug(`Watching ${this.watchFiles.length} file(s)`);
  }

  protected onStop(): void {
    this.pendingChanges.clear();
    this.disposeCollection(this.watchers);
  }

  private queueChange(fsPath: string): void {
    this.pendingChanges.add(fsPath);
    this._debouncedOnChange();
  }
}
