// packages/extension/preview/watchers/DependencyWatcher.ts
// watch local file dependencies for changes & trigger preview refresh

import * as vscode from 'vscode';
import { DEP_WATCHER_MAX_ENTRIES } from '../../constants';
import { debug } from '../../logging';
import {
  getUnifiedResolver,
  type ResolutionContext,
} from '../../module-system/resolver/UnifiedResolver';
import { BaseWatcher } from './BaseWatcher';

// watch local file dependencies (imports from MDX files) for changes
// only watches relative imports, skips node_modules & external URLs
// implements LRU eviction to prevent unbounded watcher growth
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
    // signal readiness may have changed
    this.markReady();
  }

  // set resolution context for enhanced resolution capabilities
  setResolutionContext(context: ResolutionContext): void {
    this.resolutionContext = context;
    // signal readiness may have changed
    this.markReady();
  }

  // update watched dependencies from import list (adds watchers for new dependencies & removes watchers for old ones)
  // implements LRU eviction when watcher count would exceed DEP_WATCHER_MAX_ENTRIES
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

    // Step 1: remove watchers for paths no longer imported
    for (const [fsPath, watcher] of this.watchers) {
      if (!newPaths.has(fsPath)) {
        debug(`[DEP-WATCHER] Removing watcher: ${fsPath}`);
        watcher.dispose();
        this.watchers.delete(fsPath);
      }
    }

    // Step 2: "touch" existing watchers (move to end for LRU tracking)
    // This marks them as recently used since they're still in the import list
    for (const fsPath of newPaths) {
      if (this.watchers.has(fsPath)) {
        const watcher = this.watchers.get(fsPath)!;
        this.watchers.delete(fsPath);
        this.watchers.set(fsPath, watcher);
      }
    }

    // Step 3: count how many new watchers we need
    const pathsNeedingNewWatcher: string[] = [];
    for (const fsPath of newPaths) {
      if (!this.watchers.has(fsPath)) {
        pathsNeedingNewWatcher.push(fsPath);
      }
    }

    // Step 4: evict oldest watchers if adding new ones would exceed limit
    const totalAfterAdding = this.watchers.size + pathsNeedingNewWatcher.length;
    if (totalAfterAdding > DEP_WATCHER_MAX_ENTRIES) {
      const numToEvict = totalAfterAdding - DEP_WATCHER_MAX_ENTRIES;
      this.evictOldest(numToEvict);
    }

    // Step 5: add watchers for new paths using createFileWatcher
    for (const fsPath of pathsNeedingNewWatcher) {
      debug(`[DEP-WATCHER] Adding watcher: ${fsPath}`);
      const watcher = this.createFileWatcher(fsPath, {
        onChange: () => {
          debug(`[DEP-WATCHER] File changed: ${fsPath}`);
          this.onChangeCallback(fsPath);
        },
        onDelete: () => {
          debug(`[DEP-WATCHER] File deleted: ${fsPath}`);
          this.watchers.delete(fsPath);
          watcher.dispose();
          this.onChangeCallback(fsPath);
        },
        ignoreCreateEvents: true,
        wrapErrors: true,
      });
      this.watchers.set(fsPath, watcher);
    }

    debug(`[DEP-WATCHER] Watching ${this.watchers.size} local dependencies`);
  }

  // evict the N oldest (least recently used) watchers
  // uses O(1) access to oldest entry via Map iteration order
  private evictOldest(count: number): void {
    if (count <= 0) {
      return;
    }
    let evicted = 0;
    // First entries in Map are oldest due to insertion order
    for (const [fsPath, watcher] of this.watchers) {
      if (evicted >= count) {
        break;
      }
      debug(`[DEP-WATCHER] LRU evicting watcher: ${fsPath}`);
      watcher.dispose();
      this.watchers.delete(fsPath);
      evicted++;
    }
  }

  // clear all dependencies & dispose watchers
  clear(): void {
    this.disposeCollection(this.watchers);
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
