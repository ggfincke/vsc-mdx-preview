// packages/extension-host/src/shared/config/ConfigCache.ts
// lifecycle-managed config cache preserving missing vs no-config state

import * as path from 'path';
import { createTaggedLogger } from '../logging/logger';
import { LogTags } from '@mdx-preview/contracts';
import { WithSubscribers } from '../../app/services/SingletonService';
import type { ResolvedConfig } from '../types';
import { PathCache } from '../utils/cache';
import { CONFIG_CACHE_MAX_ENTRIES } from '../constants/runtime';

const log = createTaggedLogger(LogTags.CONFIG_CACHE);

// re-export canonical type definitions from types/
export { ConfigChangeType } from '../types';
export type { ConfigChangeEvent, ConfigChangeCallback } from '../types';

import { ConfigChangeType } from '../types';
import type { ConfigChangeEvent } from '../types';

// wrapper to distinguish "not cached" from "cached as null"
interface CacheWrapper {
  config: ResolvedConfig | null;
}

// * manage cache & file watchers for MDX preview config files
// stores resolved configs, config watchers & change subscribers
// registered w/ ServiceRegistry for proper disposal
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
    super((err) => log.warn('Error in config change callback:', err));
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

  // invalidate entries for changed config path or child cached directories
  invalidate(configPath: string): void {
    const configDir = path.dirname(configPath);
    this.cache.invalidateWhere(
      (cachedDir, wrapper) =>
        wrapper.config?.configPath === configPath ||
        cachedDir.startsWith(configDir)
    );
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

  // watch a path that may not contain a valid config yet
  watchConfigCandidate(
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
