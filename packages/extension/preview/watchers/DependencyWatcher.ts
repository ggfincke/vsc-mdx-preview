// packages/extension/preview/watchers/DependencyWatcher.ts
// watch local file dependencies for changes & trigger preview refresh

import * as vscode from 'vscode';
import { debug } from '../../logging';
import {
  getUnifiedResolver,
  type ResolutionContext,
} from '../../module-fetcher/UnifiedResolver';
import { BaseWatcher } from './BaseWatcher';

// watch local file dependencies (imports from MDX files) for changes
// only watches relative imports, skips node_modules & external URLs
export class DependencyWatcher extends BaseWatcher {
  protected readonly logTag = 'DEP-WATCHER';
  private watchers = new Map<string, vscode.FileSystemWatcher>();
  private documentDir: string = '';
  private onChangeCallback: (fsPath: string) => void;
  private resolver = getUnifiedResolver();
  private resolutionContext: ResolutionContext | null = null;

  constructor(onChange: (fsPath: string) => void) {
    super();
    this.onChangeCallback = onChange;
  }

  // set base directory for resolving relative imports
  setDocumentDir(dir: string): void {
    this.documentDir = dir;
    this.markReady(); // Signal readiness may have changed
  }

  // set resolution context for enhanced resolution capabilities
  setResolutionContext(context: ResolutionContext): void {
    this.resolutionContext = context;
    this.markReady(); // Signal readiness may have changed
  }

  // update watched dependencies from import list (adds watchers for new dependencies & removes watchers for old ones)
  updateDependencies(imports: string[]): void {
    const newPaths = new Set<string>();

    // Build resolution context - use stored context or fallback to simple baseDir
    const context: ResolutionContext = this.resolutionContext ?? {
      baseDir: this.documentDir,
    };

    for (const imp of imports) {
      // Use UnifiedResolver's shouldResolve (handles URLs, npm://, empty)
      if (!this.resolver.shouldResolve(imp)) {
        continue;
      }

      // Only watch local imports (relative paths)
      if (!this.resolver.isRelativeImport(imp)) {
        continue;
      }

      // Use UnifiedResolver for resolution
      const result = this.resolver.resolveSync(imp, context, 'dependency');
      if (result && !result.isBuiltInShim) {
        newPaths.add(result.fsPath);
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
    this.disposeWatcherMap(this.watchers);
  }

  protected onStart(): void {
    // no initial setup - watchers created dynamically via updateDependencies()
  }

  protected onStop(): void {
    this.clear();
  }

  protected checkReadiness(): boolean {
    // Either have explicit context or documentDir fallback
    return this.resolutionContext !== null || this.documentDir !== '';
  }
}
