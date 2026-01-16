// packages/extension/config/ConfigCache.ts
// Encapsulates config cache state for proper lifecycle management

import * as path from 'path';
import * as vscode from 'vscode';
import { warn } from '../logging';
import { SingletonService } from '../services/SingletonService';
import type { ResolvedConfig } from '../preview/config/ConfigResolver';

// * manages the cache & file watchers for MDX preview config files
// encapsulates the global state from ConfigResolver:
// - configCache: Map of directory -> resolved config
// - configWatchers: Map of config path -> file system watcher
// - configChangeSubscribers: Set of callbacks for config changes
// registered w/ ServiceRegistry for proper disposal
export class ConfigCache extends SingletonService<ConfigCache> {
  protected static override instance: ConfigCache | undefined;
  protected readonly logTag = 'CONFIG-CACHE';

  private cache = new Map<string, ResolvedConfig | null>();
  private watchers = new Map<string, vscode.FileSystemWatcher>();
  private subscribers = new Set<(configPath: string) => void>();

  protected constructor() {
    super();
  }

  // get cached config for a directory
  get(dir: string): ResolvedConfig | null | undefined {
    return this.cache.get(dir);
  }

  // check if config is cached for a directory
  has(dir: string): boolean {
    return this.cache.has(dir);
  }

  // set cached config for a directory
  set(dir: string, config: ResolvedConfig | null): void {
    this.cache.set(dir, config);
  }

  // invalidate cache entries affected by a config file change
  invalidate(configPath: string): void {
    const configDir = path.dirname(configPath);

    // remove all cache entries that could be affected by this config file
    for (const [cachedDir, resolved] of this.cache.entries()) {
      if (
        resolved?.configPath === configPath ||
        cachedDir.startsWith(configDir)
      ) {
        this.cache.delete(cachedDir);
      }
    }
  }

  // clear all cached configs
  clear(): void {
    this.cache.clear();
  }

  // check if a watcher exists for a config path
  hasWatcher(configPath: string): boolean {
    return this.watchers.has(configPath);
  }

  // set a file watcher for a config path
  setWatcher(configPath: string, watcher: vscode.FileSystemWatcher): void {
    this.watchers.set(configPath, watcher);
  }

  // remove a watcher for a config path
  removeWatcher(configPath: string): void {
    const watcher = this.watchers.get(configPath);
    if (watcher) {
      watcher.dispose();
      this.watchers.delete(configPath);
    }
  }

  // subscribe to config file changes
  subscribe(callback: (configPath: string) => void): vscode.Disposable {
    this.subscribers.add(callback);
    return {
      dispose: () => {
        this.subscribers.delete(callback);
      },
    };
  }

  // notify subscribers of a config change
  notifyChange(configPath: string): void {
    for (const callback of this.subscribers) {
      try {
        callback(configPath);
      } catch (err) {
        warn('Error in config change callback:', err);
      }
    }
  }

  // custom cleanup - clear all caches and watchers
  protected override onDispose(): void {
    // dispose all watchers
    for (const watcher of this.watchers.values()) {
      watcher.dispose();
    }
    this.watchers.clear();
    this.subscribers.clear();
    this.cache.clear();
  }
}
