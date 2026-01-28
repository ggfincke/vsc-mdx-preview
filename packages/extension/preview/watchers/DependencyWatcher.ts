// packages/extension/preview/watchers/DependencyWatcher.ts
// watch local file dependencies for changes & trigger preview refresh

import * as vscode from 'vscode';
import { DEP_WATCHER_MAX_ENTRIES } from '../../constants';
import { debug } from '../../logging';
import { LRUCache } from '../../utils/cache/LRUCache';
import {
  getUnifiedResolver,
  type ResolutionContext,
} from '../../module-system/resolver/UnifiedResolver';
import { BaseWatcher } from './BaseWatcher';

// watch local file dependencies (imports from MDX files) for changes
// only watches relative imports, skips node_modules & external URLs
// uses LRUCache for automatic eviction to prevent unbounded watcher growth
export class DependencyWatcher extends BaseWatcher {
  protected readonly logTag = 'DEP-WATCHER';
  private watchers: LRUCache<string, vscode.FileSystemWatcher>;
  private documentDir: string = '';
  private onChangeCallback: (fsPath: string) => void;
  private resolver = getUnifiedResolver();
  private resolutionContext: ResolutionContext | null = null;

  constructor(onChange: (fsPath: string) => void) {
    super();
    this.onChangeCallback = onChange;
    this.watchers = new LRUCache({
      maxEntries: DEP_WATCHER_MAX_ENTRIES,
      onEvict: (fsPath, watcher) => {
        debug(`[DEP-WATCHER] Disposing watcher: ${fsPath}`);
        watcher.dispose();
      },
    });
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
  // LRUCache handles automatic eviction when watcher count exceeds DEP_WATCHER_MAX_ENTRIES
  updateDependencies(imports: string[]): void {
    const newPaths = new Set<string>();

    // build resolution context - use stored context or fallback to simple baseDir
    const context: ResolutionContext = this.resolutionContext ?? {
      baseDir: this.documentDir,
    };

    for (const imp of imports) {
      // use UnifiedResolver's shouldResolve (handles URLs, npm://, empty)
      if (!this.resolver.shouldResolve(imp)) {
        continue;
      }

      // only watch local imports (relative paths)
      if (!this.resolver.isRelativeImport(imp)) {
        continue;
      }

      // use UnifiedResolver for resolution
      const result = this.resolver.resolveSync(imp, context, 'dependency');
      if (result && !result.isBuiltInShim) {
        newPaths.add(result.fsPath);
      }
    }

    // Step 1: remove watchers for paths no longer imported
    // collect paths to remove first to avoid iteration issues
    const pathsToRemove: string[] = [];
    for (const fsPath of this.watchers.keys()) {
      if (!newPaths.has(fsPath)) {
        pathsToRemove.push(fsPath);
      }
    }
    for (const fsPath of pathsToRemove) {
      debug(`[DEP-WATCHER] Removing watcher (no longer imported): ${fsPath}`);
      this.watchers.delete(fsPath); // onEvict disposes watcher
    }

    // Step 2: touch existing watchers (get() updates LRU position)
    for (const fsPath of newPaths) {
      if (this.watchers.has(fsPath)) {
        this.watchers.get(fsPath); // touch to update LRU position
      }
    }

    // Step 3: add watchers for new paths
    // LRUCache auto-evicts oldest when capacity exceeded
    for (const fsPath of newPaths) {
      if (!this.watchers.has(fsPath)) {
        debug(`[DEP-WATCHER] Adding watcher: ${fsPath}`);
        const watcher = this.createFileWatcher(fsPath, {
          onChange: () => {
            debug(`[DEP-WATCHER] File changed: ${fsPath}`);
            this.onChangeCallback(fsPath);
          },
          onDelete: () => {
            debug(`[DEP-WATCHER] File deleted: ${fsPath}`);
            this.watchers.delete(fsPath); // onEvict disposes watcher
            this.onChangeCallback(fsPath);
          },
          ignoreCreateEvents: true,
          wrapErrors: true,
        });
        this.watchers.set(fsPath, watcher);
      }
    }

    debug(`[DEP-WATCHER] Watching ${this.watchers.size} local dependencies`);
  }

  // clear all dependencies & dispose watchers
  clear(): void {
    this.watchers.clearWithEviction(); // onEvict disposes each watcher
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
