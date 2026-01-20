// packages/extension/config/ConfigCache.ts
// Encapsulates config cache state for proper lifecycle management

import * as path from 'path';
import * as vscode from 'vscode';
import { warn } from '../logging';
import { SingletonService } from '../services/SingletonService';
import { SubscriberManager } from '../utils/SubscriberManager';
import { disposeCollection } from '../utils/disposable';
import type { ResolvedConfig } from '../preview/config/ConfigResolver';

// Typed config change event types
export enum ConfigChangeType {
  FileChanged = 'fileChanged',
  FileDeleted = 'fileDeleted',
  FileCreated = 'fileCreated',
}

// Typed config change event
export interface ConfigChangeEvent {
  type: ConfigChangeType;
  configPath: string;
  timestamp: number;
}

export type ConfigChangeCallback = (event: ConfigChangeEvent) => void;

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
  private subscriberManager = new SubscriberManager<ConfigChangeEvent>(
    'CONFIG-CACHE',
    (err) => warn('[CONFIG-CACHE] Error in config change callback:', err)
  );

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

  // custom cleanup - clear all caches and watchers
  protected override onDispose(): void {
    disposeCollection(this.watchers);
    this.subscriberManager.clear();
    this.cache.clear();
  }
}
