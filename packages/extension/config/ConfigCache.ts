// packages/extension/config/ConfigCache.ts
// encapsulates config cache state for proper lifecycle management

import * as path from 'path';
import * as vscode from 'vscode';
import { warn } from '../logging';
import { SingletonService } from '../services/SingletonService';
import { SubscriberManager } from '../utils/SubscriberManager';
import { disposeCollection } from '../utils/disposable';
import type { ResolvedConfig } from '../preview/config/ConfigResolver';

// typed config change event types
export enum ConfigChangeType {
  FileChanged = 'fileChanged',
  FileDeleted = 'fileDeleted',
  FileCreated = 'fileCreated',
}

// typed config change event
export interface ConfigChangeEvent {
  type: ConfigChangeType;
  configPath: string;
  timestamp: number;
}

export type ConfigChangeCallback = (event: ConfigChangeEvent) => void;

// cache entry with LRU timestamp tracking
interface CacheEntry {
  value: ResolvedConfig | null;
  lastAccessed: number;
}

// max entries before LRU eviction kicks in
const CONFIG_CACHE_MAX_ENTRIES = 100;

// * manages the cache & file watchers for MDX preview config files
// encapsulates the global state from ConfigResolver:
// - configCache: Map of directory -> resolved config (with LRU eviction)
// - configWatchers: Map of config path -> file system watcher
// - configChangeSubscribers: Set of callbacks for config changes
// registered w/ ServiceRegistry for proper disposal
export class ConfigCache extends SingletonService<ConfigCache> {
  protected static override instance: ConfigCache | undefined;
  protected readonly logTag = 'CONFIG-CACHE';

  private cache = new Map<string, CacheEntry>();
  private watchers = new Map<string, vscode.FileSystemWatcher>();
  private subscriberManager = new SubscriberManager<ConfigChangeEvent>(
    'CONFIG-CACHE',
    (err) => warn('[CONFIG-CACHE] Error in config change callback:', err)
  );

  protected constructor() {
    super();
  }

  // get cached config for a directory (updates LRU position)
  // returns undefined if not cached, null if cached "no config found"
  get(dir: string): ResolvedConfig | null | undefined {
    const entry = this.cache.get(dir);
    if (entry === undefined) {
      return undefined; // not cached
    }

    // Update LRU position (delete + re-insert at end)
    this.cache.delete(dir);
    entry.lastAccessed = Date.now();
    this.cache.set(dir, entry);

    return entry.value;
  }

  // check if config is cached for a directory
  has(dir: string): boolean {
    return this.cache.has(dir);
  }

  // set cached config for a directory (with LRU eviction)
  set(dir: string, config: ResolvedConfig | null): void {
    // Remove existing entry first (for LRU reordering)
    this.cache.delete(dir);

    // Evict oldest if at capacity (first entry is LRU due to Map order)
    while (this.cache.size >= CONFIG_CACHE_MAX_ENTRIES) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey === undefined) {
        break;
      }
      this.cache.delete(oldestKey);
    }

    this.cache.set(dir, {
      value: config,
      lastAccessed: Date.now(),
    });
  }

  // invalidate cache entries affected by a config file change
  invalidate(configPath: string): void {
    const configDir = path.dirname(configPath);

    // remove all cache entries that could be affected by this config file
    for (const [cachedDir, entry] of this.cache.entries()) {
      if (
        entry.value?.configPath === configPath ||
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
  subscribe(callback: ConfigChangeCallback): vscode.Disposable {
    return this.subscriberManager.subscribe(callback);
  }

  // notify subscribers of a config change
  notifyChange(
    configPath: string,
    type: ConfigChangeType = ConfigChangeType.FileChanged
  ): void {
    this.subscriberManager.notify({
      type,
      configPath,
      timestamp: Date.now(),
    });
  }

  // custom cleanup - clear all caches & watchers
  protected override onDispose(): void {
    disposeCollection(this.watchers);
    this.subscriberManager.clear();
    this.cache.clear();
  }
}
