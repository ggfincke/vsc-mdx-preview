// packages/extension/preview/watchers/TailwindConfigWatcher.ts
// watch Tailwind config & entry CSS files for changes

import * as vscode from 'vscode';
import { createTaggedLogger } from '../../../shared/logging/logger';
import { BaseWatcher } from './BaseWatcher';
import { LogTags, STANDARD_DEBOUNCE_MS } from '@mdx-preview/contracts';

// module-level tagged logger
const log = createTaggedLogger(LogTags.TAILWIND_WATCHER);

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
      log.debug(`Creating watcher for: ${file}`);
      // use createFileWatcher from base class w/ error wrapping
      const watcher = this.createFileWatcher(file, {
        onChange: (uri) => {
          log.debug(`File changed: ${uri.fsPath}`);
          this.queueChange(uri.fsPath);
        },
        onCreate: (uri) => {
          log.debug(`File created: ${uri.fsPath}`);
          this.queueChange(uri.fsPath);
        },
        onDelete: (uri) => {
          log.debug(`File deleted: ${uri.fsPath}`);
          this.queueChange(uri.fsPath);
        },
        wrapErrors: true,
      });
      this.watchers.push(watcher);
    }
    log.debug(`Watching ${this.watchFiles.length} file(s)`);
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
