// packages/extension/config/ConfigCache.ts
// encapsulate config cache state for proper lifecycle management
// use LRUCache for automatic eviction while preserving the distinction
// between "not cached" (undefined) & "cached as no config" (null)

import * as path from 'path';
import { createTaggedLogger } from '../logging';
import { LogTags } from '@mdx-preview/shared';
import { WithSubscribers } from '../services/SingletonService';
import type { ResolvedConfig } from '../types';
import { PathCache } from '../utils/cache';

const log = createTaggedLogger(LogTags.CONFIG_CACHE);

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

// * manage cache & file watchers for MDX preview config files
// encapsulate the global state from ConfigResolver
// configCache: Map of directory -> resolved config (w/ LRU eviction)
// configWatchers: track config path -> watcher instance
// configChangeSubscribers: Set of callbacks for config changes
// register w/ ServiceRegistry for proper disposal
export class ConfigCache extends WithSubscribers<
  ConfigCache,
  ConfigChangeEvent
> {
  protected static override instance: ConfigCache | undefined;
  protected readonly logTag = LogTags.CONFIG_CACHE;

  // wrap LRU cache values to distinguish "not cached" from "cached as null"
  private cache = new PathCache<CacheWrapper>({
    logTag: LogTags.CONFIG_CACHE,
    maxEntries: CONFIG_CACHE_MAX_ENTRIES,
  });

  protected constructor() {
    super(LogTags.CONFIG_CACHE, (err) =>
      log.warn('Error in config change callback:', err)
    );
  }

  // retrieve cached config for a directory (update LRU position)
  // return undefined if not cached, null if cached as "no config found"
  get(dir: string): ResolvedConfig | null | undefined {
    const wrapper = this.cache.get(dir);
    if (!wrapper) {
      return undefined;
    }
    return wrapper.config;
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
  // remove all entries where
  // - The entry's configPath matches the changed file
  // - The cached directory is w/in the changed config's directory
  invalidate(configPath: string): void {
    const configDir = path.dirname(configPath);

    // collect keys to delete (can't modify during iteration)
    const toDelete: string[] = [];

    for (const [cachedDir, wrapper] of this.cache.entries()) {
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
    return this.cache.hasWatcher(configPath);
  }

  // register handlers for a config path watcher
  watchConfigPath(
    configPath: string,
    handlers: Parameters<PathCache<CacheWrapper>['watchPath']>[1]
  ): void {
    this.cache.watchPath(configPath, handlers);
  }

  // unregister a watcher for a config path
  unwatchConfigPath(configPath: string): void {
    this.cache.unwatchPath(configPath);
  }

  // dispatch config change notifications to subscribers
  notifyChange(
    configPath: string,
    type: ConfigChangeType = ConfigChangeType.FileChanged
  ): void {
    this.notifySubscribers({
      type,
      configPath,
      timestamp: Date.now(),
    });
  }

  // clean up all caches & watchers
  protected override onDispose(): void {
    this.cache.dispose();
  }
}
