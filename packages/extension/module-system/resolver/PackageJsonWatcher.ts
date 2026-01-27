// packages/extension/module-system/resolver/PackageJsonWatcher.ts
// watches package.json & lock files to invalidate resolver cache

import * as vscode from 'vscode';
import { debug } from '../../logging';
import { BaseWatcher } from '../../preview/watchers/BaseWatcher';
import { getConfigManager } from '../../services';

// get configurable debounce value from ConfigManager
function getWatcherDebounce(): number {
  return getConfigManager().get('advanced.watcherDebounceMs');
}

// watches for package.json & lock file changes to trigger resolver cache invalidation
// ensures module resolution stays up-to-date when dependencies change
export class PackageJsonWatcher extends BaseWatcher {
  protected readonly logTag = 'PKG-JSON';

  private packageJsonWatcher?: vscode.FileSystemWatcher;
  private lockFileWatcher?: vscode.FileSystemWatcher;
  private debounceTimer?: ReturnType<typeof setTimeout>;
  private onInvalidate?: () => void;

  constructor(onInvalidate?: () => void) {
    super();
    if (onInvalidate) {
      this.onInvalidate = onInvalidate;
    }
  }

  // allow setting callback after construction (for backward compatibility)
  setOnInvalidate(callback: () => void): void {
    this.onInvalidate = callback;
  }

  protected async onStart(): Promise<void> {
    // watch package.json files in workspace
    // ignoreCreateEvents: new package.json doesn't affect existing resolution
    // ignoreChangeEvents: false - changes matter
    // ignoreDeleteEvents: deletion doesn't affect resolution until next resolve
    this.packageJsonWatcher = vscode.workspace.createFileSystemWatcher(
      '**/package.json',
      true,
      false,
      true
    );

    // watch lock files (npm, yarn, pnpm)
    // ignoreCreateEvents: true
    // ignoreChangeEvents: false - lock file changes indicate dependency updates
    // ignoreDeleteEvents: true
    this.lockFileWatcher = vscode.workspace.createFileSystemWatcher(
      '**/{package-lock.json,yarn.lock,pnpm-lock.yaml}',
      true,
      false,
      true
    );

    this.packageJsonWatcher.onDidChange((uri) =>
      this.handleChange(uri, 'package.json')
    );
    this.lockFileWatcher.onDidChange((uri) =>
      this.handleChange(uri, 'lock file')
    );

    debug('[PKG-JSON] Started watching package files');
    this.markReady();
  }

  protected onStop(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
    this.disposeWatcher(this.packageJsonWatcher);
    this.disposeWatcher(this.lockFileWatcher);
    this.packageJsonWatcher = undefined;
    this.lockFileWatcher = undefined;
  }

  protected onDispose(): void {
    this.onInvalidate = undefined;
  }

  // handle file change event w/ debouncing
  private handleChange(uri: vscode.Uri, fileType: string): void {
    debug(`[PKG-JSON] ${fileType} changed: ${uri.fsPath}`);

    // debounce rapid changes (e.g., during npm install)
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      debug('[PKG-JSON] Triggering cache invalidation');
      this.onInvalidate?.();
      this.debounceTimer = undefined;
    }, getWatcherDebounce());
  }
}
