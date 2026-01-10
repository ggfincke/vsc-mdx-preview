// packages/extension/preview/watchers/DependencyWatcher.ts
// watch local file dependencies for changes & trigger preview refresh

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { debug } from '../../logging';

// watches local file dependencies (imports from MDX files) for changes (only relative imports, skips node_modules & external URLs)
export class DependencyWatcher {
  private watchers = new Map<string, vscode.FileSystemWatcher>();
  private documentDir: string = '';
  private onChangeCallback: (fsPath: string) => void;

  constructor(onChange: (fsPath: string) => void) {
    this.onChangeCallback = onChange;
  }

  // set base directory for resolving relative imports
  setDocumentDir(dir: string): void {
    this.documentDir = dir;
  }

  // check if import is local file (not node_modules, http, npm://)
  private isLocalImport(specifier: string): boolean {
    if (!specifier) {
      return false;
    }
    if (specifier.startsWith('http://') || specifier.startsWith('https://')) {
      return false;
    }
    if (specifier.startsWith('npm://')) {
      return false;
    }
    // only watch relative imports
    return specifier.startsWith('./') || specifier.startsWith('../');
  }

  // resolve relative import to absolute path (tries common extensions if exact path doesn't exist)
  private resolveImport(specifier: string): string | null {
    if (!this.documentDir) {
      return null;
    }

    const resolved = path.resolve(this.documentDir, specifier);

    // skip if in node_modules
    if (resolved.includes('node_modules')) {
      return null;
    }

    // check if file exists (with common extensions)
    const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.mdx'];
    for (const ext of extensions) {
      const fullPath = resolved + ext;
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }

    // check for index files
    for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
      const indexPath = path.join(resolved, `index${ext}`);
      if (fs.existsSync(indexPath)) {
        return indexPath;
      }
    }

    return null;
  }

  // update watched dependencies from import list (adds watchers for new dependencies & removes watchers for old ones)
  updateDependencies(imports: string[]): void {
    const newPaths = new Set<string>();

    for (const imp of imports) {
      if (!this.isLocalImport(imp)) {
        continue;
      }

      const resolved = this.resolveImport(imp);
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

  // dispose of all watchers
  dispose(): void {
    this.clear();
  }
}
