// packages/extension/module-system/resolver/PackageJsonWatcher.ts
// watch package.json & lock files to invalidate resolver cache

import * as vscode from 'vscode';
import { LogTags } from '@mdx-preview/contracts';
import { BaseWatcher } from '../../preview/watchers/BaseWatcher';
import { getConfigManager } from '../../../app/services';
import { SETTINGS } from '../../../shared/config/ConfigManager';

// get configurable debounce value from ConfigManager
function getWatcherDebounce(): number {
  return getConfigManager().get(SETTINGS.WATCHER_DEBOUNCE_MS);
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
      this.log.debug('Triggering cache invalidation');
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
      enableEventLogging: false,
    });

    // watch lock files (npm, yarn, pnpm)
    this.lockFileWatcher = this.createFileWatcher(
      '**/{package-lock.json,yarn.lock,pnpm-lock.yaml}',
      {
        ignoreCreateEvents: true,
        ignoreDeleteEvents: true,
        onChange: (uri) => this.handleChange(uri, 'lock file'),
        enableEventLogging: false,
      }
    );

    this.log.debug('Started watching package files');
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
    this.log.debug(`${fileType} changed: ${uri.fsPath}`);
    this._debouncedInvalidate();
  }
}
