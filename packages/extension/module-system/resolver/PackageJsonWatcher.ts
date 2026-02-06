// packages/extension/module-system/resolver/PackageJsonWatcher.ts
// watches package.json & lock files to invalidate resolver cache

import * as vscode from 'vscode';
import { createTaggedLogger } from '../../logging';
import { LogTags } from '@mdx-preview/shared';
import { BaseWatcher } from '../../preview/watchers/BaseWatcher';
import { getConfigManager } from '../../services';

// module-level tagged logger for package.json watcher
const log = createTaggedLogger(LogTags.PKG_JSON);

// get configurable debounce value from ConfigManager
function getWatcherDebounce(): number {
  return getConfigManager().get('advanced.watcherDebounceMs');
}

// watch for package.json & lock file changes to trigger resolver cache invalidation
// ensure module resolution stays up-to-date when dependencies change
export class PackageJsonWatcher extends BaseWatcher {
  protected readonly logTag = LogTags.PKG_JSON;

  private packageJsonWatcher?: vscode.FileSystemWatcher;
  private lockFileWatcher?: vscode.FileSystemWatcher;
  private _debouncedInvalidate: (() => void) & {
    cancel(): void;
    flush(): void;
  };

  constructor(onInvalidate?: () => void) {
    super();
    // create debounced invalidation handler
    this._debouncedInvalidate = this.createDebouncedHandler(() => {
      log.debug('Triggering cache invalidation');
      onInvalidate?.();
    }, getWatcherDebounce());
  }

  protected async onStart(): Promise<void> {
    // watch package.json files in workspace
    // ignoreCreateEvents: new package.json doesn't affect existing resolution
    // ignoreDeleteEvents: deletion doesn't affect resolution until next resolve
    this.packageJsonWatcher = this.createFileWatcher('**/package.json', {
      ignoreCreateEvents: true,
      ignoreDeleteEvents: true,
      onChange: (uri) => this.handleChange(uri, 'package.json'),
    });

    // watch lock files (npm, yarn, pnpm)
    this.lockFileWatcher = this.createFileWatcher(
      '**/{package-lock.json,yarn.lock,pnpm-lock.yaml}',
      {
        ignoreCreateEvents: true,
        ignoreDeleteEvents: true,
        onChange: (uri) => this.handleChange(uri, 'lock file'),
      }
    );

    log.debug('Started watching package files');
    this.markReady();
  }

  protected onStop(): void {
    this.disposeWatcher(this.packageJsonWatcher);
    this.disposeWatcher(this.lockFileWatcher);
    this.packageJsonWatcher = undefined;
    this.lockFileWatcher = undefined;
  }

  // handle file change event w/ debouncing
  private handleChange(uri: vscode.Uri, fileType: string): void {
    log.debug(`${fileType} changed: ${uri.fsPath}`);
    this._debouncedInvalidate();
  }
}
