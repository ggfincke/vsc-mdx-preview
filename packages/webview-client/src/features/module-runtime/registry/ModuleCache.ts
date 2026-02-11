// packages/webview-app/src/module-system/registry/ModuleCache.ts
// module cache w/ LRU eviction (count + memory based) & pending fetch tracking
// use shared LRUCache w/ isProtected for preloaded module protection

import { LRUCache } from '@mdx-preview/runtime-utils';
import type { Module } from 'mdx-forge/browser';

// lru configuration defaults
const DEFAULT_MAX_MODULES = 500;
// 50MB
const DEFAULT_MAX_MEMORY_BYTES = 50 * 1024 * 1024;

// cache entry combining module w/ size estimate
interface CacheEntry {
  module: Module;
  estimatedSize: number;
}

// lru configuration options
export interface ModuleCacheConfig {
  maxModules?: number;
  maxMemoryBytes?: number;
}

// lru cache for evaluated modules w/ memory-aware eviction
// use shared LRUCache w/ isProtected predicate for preloaded module protection
// preloaded modules are protected from eviction & don't count against limits
export class ModuleCache {
  private cache: LRUCache<string, CacheEntry>;
  private pendingFetches: Map<string, Promise<Module>> = new Map();
  private preloadedIds: Set<string> = new Set();

  // eviction cleanup callback
  onEvict?: (id: string) => void;

  constructor() {
    this.cache = new LRUCache<string, CacheEntry>({
      maxEntries: DEFAULT_MAX_MODULES,
      maxMemoryBytes: DEFAULT_MAX_MEMORY_BYTES,
      estimateSize: (entry) => entry.estimatedSize,
      isProtected: (id) => this.preloadedIds.has(id),
      onEvict: (id) => this.onEvict?.(id),
    });
  }

  // configure lru limits
  configure(options: ModuleCacheConfig): void {
    this.cache.updateSettings({
      maxEntries: options.maxModules,
      maxMemoryBytes: options.maxMemoryBytes,
    });
  }

  // get current memory usage in bytes
  get memoryBytes(): number {
    return this.cache.memoryBytes;
  }

  // get number of cached modules
  get size(): number {
    return this.cache.size;
  }

  // get number of preloaded modules
  get preloadedCount(): number {
    return this.preloadedIds.size;
  }

  // get number of pending fetches
  get pendingCount(): number {
    return this.pendingFetches.size;
  }

  // preload module (for built-in modules like React)
  // preloaded modules are protected from eviction & don't count against limits
  preload(id: string, exports: unknown): void {
    this.preloadedIds.add(id);
    const estimatedSize = this.estimateExportsSize(exports);
    this.cache.set(id, {
      module: { id, exports, loaded: true },
      estimatedSize,
    });
  }

  // get cached module (update lru position)
  get(id: string): Module | undefined {
    const entry = this.cache.get(id);
    return entry?.module;
  }

  // check if module is cached
  has(id: string): boolean {
    return this.cache.has(id);
  }

  // check if module is preloaded (protected from eviction)
  isPreloaded(id: string): boolean {
    return this.preloadedIds.has(id);
  }

  // set module in cache w/ automatic lru eviction
  set(id: string, module: Module): void {
    const estimatedSize = this.estimateExportsSize(module.exports);
    this.cache.set(id, { module, estimatedSize });
  }

  // delete module from cache, return the estimated size freed
  delete(id: string): number {
    if (this.preloadedIds.has(id)) {
      // don't delete preloaded modules
      return 0;
    }
    const entry = this.cache.peek(id);
    const freedSize = entry?.estimatedSize ?? 0;
    this.cache.delete(id);
    return freedSize;
  }

  // estimate memory size of module exports (rough approximation)
  // used for memory-aware cache eviction
  private estimateExportsSize(exports: unknown): number {
    if (exports === null || exports === undefined) {
      return 8;
    }

    if (typeof exports === 'string') {
      // 2 bytes per char (UTF-16) + object overhead
      return exports.length * 2 + 40;
    }

    if (typeof exports === 'function') {
      // rough estimate for function size (source code length if available)
      const funcString = exports.toString();
      return funcString.length * 2 + 100;
    }

    if (typeof exports === 'object') {
      // rough estimate: traverse one level deep
      // object overhead
      let size = 40;
      const obj = exports as Record<string, unknown>;
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          // key & pointer
          size += key.length * 2 + 8;
          const value = obj[key];
          if (typeof value === 'string') {
            size += value.length * 2;
          } else if (typeof value === 'function') {
            size += value.toString().length * 2 + 100;
          } else if (typeof value === 'object' && value !== null) {
            // rough estimate for nested objects
            size += 200;
          } else {
            // primitive
            size += 8;
          }
        }
      }
      return size;
    }

    // primitive
    return 8;
  }

  // pending fetch management (for circular dependency detection)

  // get pending fetch promise
  getPending(id: string): Promise<Module> | undefined {
    return this.pendingFetches.get(id);
  }

  // set pending fetch promise
  setPending(id: string, promise: Promise<Module>): void {
    this.pendingFetches.set(id, promise);
  }

  // clear pending fetch
  clearPending(id: string): void {
    this.pendingFetches.delete(id);
  }

  // clear all pending fetches
  clearAllPending(): void {
    this.pendingFetches.clear();
  }

  // bulk operations

  // clear all cached modules except preloaded ones
  clearNonPreloaded(): void {
    for (const id of this.cache.keys()) {
      if (!this.preloadedIds.has(id)) {
        this.cache.delete(id);
      }
    }
    this.pendingFetches.clear();
  }

  // clear all cached modules
  clear(): void {
    this.cache.clear();
    this.pendingFetches.clear();
    this.preloadedIds.clear();
  }
}
