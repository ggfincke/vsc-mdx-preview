// packages/extension/module-fetcher/PackageJsonWatcher.ts
// watches package.json & lock files to invalidate resolver cache

import * as vscode from 'vscode';
import { debug } from '../logging';
import { PACKAGE_JSON_WATCHER_DEBOUNCE_MS } from '../constants';

// * watches for package.json & lock file changes to trigger resolver cache invalidation
// ensures module resolution stays up-to-date when dependencies change
export class PackageJsonWatcher implements vscode.Disposable {
  private watcher: vscode.FileSystemWatcher | null = null;
  private lockWatcher: vscode.FileSystemWatcher | null = null;
  private onInvalidate: (() => void) | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;

  // start watching for package file changes
  start(onInvalidate: () => void): void {
    this.onInvalidate = onInvalidate;

    // watch package.json files in workspace
    // ignoreCreateEvents: new package.json doesn't affect existing resolution
    // ignoreChangeEvents: false - changes matter
    // ignoreDeleteEvents: deletion doesn't affect resolution until next resolve
    this.watcher = vscode.workspace.createFileSystemWatcher(
      '**/package.json',
      true,
      false,
      true
    );

    // watch lock files (npm, yarn, pnpm)
    // ignoreCreateEvents: true
    // ignoreChangeEvents: false - lock file changes indicate dependency updates
    // ignoreDeleteEvents: true
    this.lockWatcher = vscode.workspace.createFileSystemWatcher(
      '**/{package-lock.json,yarn.lock,pnpm-lock.yaml}',
      true,
      false,
      true
    );

    this.watcher.onDidChange((uri) => this.handleChange(uri, 'package.json'));
    this.lockWatcher.onDidChange((uri) =>
      this.handleChange(uri, 'lock file')
    );

    debug('[RESOLVER-WATCHER] Started watching package files');
  }

  // handle file change event w/ debouncing
  private handleChange(uri: vscode.Uri, fileType: string): void {
    debug(`[RESOLVER-WATCHER] ${fileType} changed: ${uri.fsPath}`);

    // debounce rapid changes (e.g., during npm install)
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      debug('[RESOLVER-WATCHER] Triggering cache invalidation');
      this.onInvalidate?.();
      this.debounceTimer = null;
    }, PACKAGE_JSON_WATCHER_DEBOUNCE_MS);
  }

  // stop watching & clean up resources
  dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.watcher?.dispose();
    this.lockWatcher?.dispose();
    this.watcher = null;
    this.lockWatcher = null;
    this.onInvalidate = null;
    debug('[RESOLVER-WATCHER] Disposed');
  }
}
