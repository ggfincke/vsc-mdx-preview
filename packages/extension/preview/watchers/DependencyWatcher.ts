// packages/extension/preview/watchers/DependencyWatcher.ts
// watch local file dependencies for changes & trigger preview refresh

import * as vscode from 'vscode';
import { debug } from '../../logging';
import {
  isLocalImport,
  resolveImportSync,
} from '../../module-fetcher/resolve-import';
import type { IWatcher } from './types';

// watch local file dependencies (imports from MDX files) for changes
// only watches relative imports, skips node_modules & external URLs
export class DependencyWatcher implements IWatcher {
  private watchers = new Map<string, vscode.FileSystemWatcher>();
  private documentDir: string = '';
  private onChangeCallback: (fsPath: string) => void;
  private _isActive = false;

  constructor(onChange: (fsPath: string) => void) {
    this.onChangeCallback = onChange;
  }

  // set base directory for resolving relative imports
  setDocumentDir(dir: string): void {
    this.documentDir = dir;
  }

  // update watched dependencies from import list (adds watchers for new dependencies & removes watchers for old ones)
  updateDependencies(imports: string[]): void {
    const newPaths = new Set<string>();

    for (const imp of imports) {
      // Use shared utility for import classification (handles null, URLs, npm://)
      if (!isLocalImport(imp) || !this.documentDir) {
        continue;
      }

      // Use shared utility for import resolution
      const resolved = resolveImportSync(this.documentDir, imp);
      if (resolved) {
        newPaths.add(resolved);
      }
    }

    // remove watchers for paths no longer imported
    for (const [fsPath, watcher] of this.watchers) {
      if (!newPaths.has(fsPath)) {
        debug(`[DEP-WATCHER] Removing watcher: ${fsPath}`);
        watcher.dispose();
        this.watchers.delete(fsPath);
      }
    }

    // add watchers for new paths
    for (const fsPath of newPaths) {
      if (!this.watchers.has(fsPath)) {
        debug(`[DEP-WATCHER] Adding watcher: ${fsPath}`);
        const watcher = vscode.workspace.createFileSystemWatcher(fsPath);

        watcher.onDidChange(() => {
          debug(`[DEP-WATCHER] File changed: ${fsPath}`);
          this.onChangeCallback(fsPath);
        });

        watcher.onDidDelete(() => {
          debug(`[DEP-WATCHER] File deleted: ${fsPath}`);
          this.watchers.delete(fsPath);
          watcher.dispose();
          this.onChangeCallback(fsPath);
        });

        this.watchers.set(fsPath, watcher);
      }
    }

    debug(`[DEP-WATCHER] Watching ${this.watchers.size} local dependencies`);
  }

  // clear all dependencies & dispose watchers
  clear(): void {
    for (const watcher of this.watchers.values()) {
      watcher.dispose();
    }
    this.watchers.clear();
  }

  // IWatcher interface implementation

  start(): void {
    this._isActive = true;
    debug('[DEP-WATCHER] Started');
  }

  stop(): void {
    this._isActive = false;
    this.clear();
    debug('[DEP-WATCHER] Stopped');
  }

  isActive(): boolean {
    return this._isActive;
  }

  dispose(): void {
    this.stop();
  }
}
