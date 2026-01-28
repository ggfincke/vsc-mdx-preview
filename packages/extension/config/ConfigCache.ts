// packages/extension/config/ConfigCache.ts
// encapsulate config cache state for proper lifecycle management
//
// use LRUCache for automatic eviction while preserving the distinction
// between "not cached" (undefined) & "cached as no config" (null)

import * as path from 'path';
import * as vscode from 'vscode';
import { warn } from '../logging';
import { SingletonService } from '../services/SingletonService';
import { SubscriberManager } from '../utils/SubscriberManager';
import { LRUCache } from '../utils/cache';
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

// max entries before LRU eviction kicks in
const CONFIG_CACHE_MAX_ENTRIES = 100;

// wrapper to distinguish "not cached" from "cached as null"
interface CacheWrapper {
  config: ResolvedConfig | null;
}

// manages the cache & file watchers for MDX preview config files
// encapsulates the global state from ConfigResolver:
// - configCache: Map of directory -> resolved config (w/ LRU eviction)
// - configWatchers: Map of config path -> file system watcher
// - configChangeSubscribers: Set of callbacks for config changes
// registered w/ ServiceRegistry for proper disposal
export class ConfigCache extends SingletonService<ConfigCache> {
  protected static override instance: ConfigCache | undefined;
  protected readonly logTag = 'CONFIG-CACHE';

  // wrap LRU cache values to distinguish "not cached" from "cached as null"
  private cache = new LRUCache<string, CacheWrapper>({
    maxEntries: CONFIG_CACHE_MAX_ENTRIES,
  });
  private watchers = new Map<string, vscode.FileSystemWatcher>();
  private subscriberManager = new SubscriberManager<ConfigChangeEvent>(
    'CONFIG-CACHE',
    (err) => warn('[CONFIG-CACHE] Error in config change callback:', err)
  );

  protected constructor() {
    super();
  }

  // retrieve cached config for a directory (update LRU position)
  // return undefined if not cached, null if cached as "no config found"
  get(dir: string): ResolvedConfig | null | undefined {
    const wrapper = this.cache.get(dir);
    if (wrapper === null) {
      return undefined; // not cached (LRUCache returns null for missing keys)
    }
    return wrapper.config; // may be null or ResolvedConfig
  }

  // determine if config is cached for a directory
  has(dir: string): boolean {
    return this.cache.has(dir);
  }

  // store cached config for a directory (w/ automatic LRU eviction)
  set(dir: string, config: ResolvedConfig | null): void {
    this.cache.set(dir, { config });
  }

  // invalidate cache entries affected by a config file change
  // remove all entries where:
  // - The entry's configPath matches the changed file
  // - The cached directory is w/in the changed config's directory
  invalidate(configPath: string): void {
    const configDir = path.dirname(configPath);

    // collect keys to delete (can't modify during iteration)
    const toDelete: string[] = [];

    for (const [cachedDir] of this.cache.entries()) {
      // peek at value w/o updating LRU position
      const wrapper = this.cache.peek(cachedDir);
      if (
        wrapper?.config?.configPath === configPath ||
        cachedDir.startsWith(configDir)
      ) {
        toDelete.push(cachedDir);
      }
    }

    for (const key of toDelete) {
      this.cache.delete(key);
    }
  }

  // clear all cached configs
  clear(): void {
    this.cache.clear();
  }

  // determine if a watcher exists for a config path
  hasWatcher(configPath: string): boolean {
    return this.watchers.has(configPath);
  }

  // register a file watcher for a config path
  setWatcher(configPath: string, watcher: vscode.FileSystemWatcher): void {
    this.watchers.set(configPath, watcher);
  }

  // unregister a watcher for a config path
  removeWatcher(configPath: string): void {
    const watcher = this.watchers.get(configPath);
    if (watcher) {
      watcher.dispose();
      this.watchers.delete(configPath);
    }
  }

  // register callback for config file changes
  subscribe(callback: ConfigChangeCallback): vscode.Disposable {
    return this.subscriberManager.subscribe(callback);
  }

  // dispatch config change notifications to subscribers
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

  // clean up all caches & watchers
  protected override onDispose(): void {
    disposeCollection(this.watchers);
    this.subscriberManager.clear();
    this.cache.clear();
  }
}
