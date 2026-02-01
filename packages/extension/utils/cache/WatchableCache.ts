// packages/extension/utils/cache/WatchableCache.ts
// manage LRU cache entries w/ optional path watchers

import type * as vscode from 'vscode';
import type { LogTag } from '@mdx-preview/shared';
import { LRUCache } from '@mdx-preview/shared';
import { createFileWatcher } from '../createFileWatcher';

export type WatchEventType = 'change' | 'create' | 'delete';

export interface WatchableCacheOptions {
  // label for watcher logging
  logTag: LogTag;
  // max LRU entries (optional)
  maxEntries?: number;
  // cache TTL in milliseconds (optional)
  ttlMs?: number;
}

export interface WatchHandlers<K, V> {
  // handle file change events
  onChange?: (eventPath: string, cache: WatchableCache<K, V>) => void;
  // handle file create events
  onCreate?: (eventPath: string, cache: WatchableCache<K, V>) => void;
  // handle file delete events
  onDelete?: (eventPath: string, cache: WatchableCache<K, V>) => void;
}

// cache wrapper w/ path watcher registry
export class WatchableCache<K, V> {
  private cache: LRUCache<K, V>;
  private watchers = new Map<string, vscode.FileSystemWatcher>();
  private handlers = new Map<string, WatchHandlers<K, V>>();
  private logTag: LogTag;

  constructor(options: WatchableCacheOptions) {
    this.cache = new LRUCache<K, V>({
      maxEntries: options.maxEntries ?? 100,
      ttlMs: options.ttlMs,
    });
    this.logTag = options.logTag;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value === null) {
      return undefined;
    }
    return value;
  }

  peek(key: K): V | undefined {
    const value = this.cache.peek(key);
    if (value === null) {
      return undefined;
    }
    return value;
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  set(key: K, value: V): void {
    this.cache.set(key, value);
  }

  delete(key: K): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  entries(): IterableIterator<[K, V]> {
    return this.cache.entries();
  }

  invalidateWhere(predicate: (key: K, value: V) => boolean): void {
    const toDelete: K[] = [];
    for (const [key, value] of this.cache.entries()) {
      if (predicate(key, value)) {
        toDelete.push(key);
      }
    }
    for (const key of toDelete) {
      this.cache.delete(key);
    }
  }

  hasWatcher(path: string): boolean {
    return this.watchers.has(path);
  }

  watchPath(pattern: string, handlers: WatchHandlers<K, V>): void {
    if (this.watchers.has(pattern)) {
      return;
    }

    const watcher = createFileWatcher({
      pattern,
      logTag: this.logTag,
      onChange: (uri) => this.handleEvent(pattern, uri.fsPath, 'change'),
      onCreate: (uri) => this.handleEvent(pattern, uri.fsPath, 'create'),
      onDelete: (uri) => this.handleEvent(pattern, uri.fsPath, 'delete'),
    });

    this.watchers.set(pattern, watcher);
    this.handlers.set(pattern, handlers);
  }

  unwatchPath(pattern: string): void {
    const watcher = this.watchers.get(pattern);
    if (watcher) {
      watcher.dispose();
      this.watchers.delete(pattern);
      this.handlers.delete(pattern);
    }
  }

  dispose(): void {
    for (const watcher of this.watchers.values()) {
      watcher.dispose();
    }
    this.watchers.clear();
    this.handlers.clear();
    this.cache.clear();
  }

  private handleEvent(
    pattern: string,
    eventPath: string,
    type: WatchEventType
  ): void {
    const handlers = this.handlers.get(pattern);
    if (!handlers) {
      return;
    }

    if (type === 'change') {
      handlers.onChange?.(eventPath, this);
      return;
    }

    if (type === 'create') {
      handlers.onCreate?.(eventPath, this);
      return;
    }

    handlers.onDelete?.(eventPath, this);
  }
}
