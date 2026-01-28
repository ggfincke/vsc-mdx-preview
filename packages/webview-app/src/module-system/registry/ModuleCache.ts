// packages/webview-app/src/module-system/registry/ModuleCache.ts
// module cache w/ LRU eviction (count + memory based) & pending fetch tracking

import type { Module } from '../types';

// LRU configuration defaults
const DEFAULT_MAX_MODULES = 500;
const DEFAULT_MAX_MEMORY_BYTES = 50 * 1024 * 1024; // 50MB

// Cache entry w/ access tracking for LRU & memory tracking
interface CacheEntry {
  module: Module;
  lastAccessed: number;
  estimatedSize: number; // estimated memory footprint in bytes
}

// LRU configuration options
export interface ModuleCacheConfig {
  maxModules?: number;
  maxMemoryBytes?: number;
}

// LRU cache for evaluated modules w/ memory-aware eviction
// uses Map insertion order for O(1) LRU tracking
// preloaded modules are protected from eviction
export class ModuleCache {
  private cache: Map<string, CacheEntry> = new Map();
  private pendingFetches: Map<string, Promise<Module>> = new Map();
  private preloadedIds: Set<string> = new Set();

  // LRU configuration
  private maxModules = DEFAULT_MAX_MODULES;
  private maxMemoryBytes = DEFAULT_MAX_MEMORY_BYTES;

  // Memory tracking
  private totalMemoryBytes = 0;

  // Callback for cleanup when evicting (set by ModuleRegistry)
  onEvict?: (id: string) => void;

  // configure LRU limits
  configure(options: ModuleCacheConfig): void {
    if (options.maxModules !== undefined) {
      this.maxModules = options.maxModules;
    }
    if (options.maxMemoryBytes !== undefined) {
      this.maxMemoryBytes = options.maxMemoryBytes;
    }
  }

  // get current memory usage in bytes
  get memoryBytes(): number {
    return this.totalMemoryBytes;
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
  // preloaded modules are protected from eviction & don't count against memory limit
  preload(id: string, exports: unknown): void {
    this.preloadedIds.add(id);
    const estimatedSize = this.estimateExportsSize(exports);
    this.cache.set(id, {
      module: { id, exports, loaded: true },
      lastAccessed: Date.now(),
      estimatedSize,
    });
    // Don't count preloaded modules against memory limit
  }

  // get cached module (update access time for LRU)
  // use delete + re-insert to maintain Map insertion order (O(1) LRU)
  get(id: string): Module | undefined {
    const entry = this.cache.get(id);
    if (entry) {
      // Move to end (most recently used) via delete + re-insert
      this.cache.delete(id);
      entry.lastAccessed = Date.now();
      this.cache.set(id, entry);
      return entry.module;
    }
    return undefined;
  }

  // check if module is cached
  has(id: string): boolean {
    return this.cache.has(id);
  }

  // check if module is preloaded (protected from eviction)
  isPreloaded(id: string): boolean {
    return this.preloadedIds.has(id);
  }

  // set module in cache w/ LRU eviction (memory-based + count-based)
  // evict non-preloaded modules when at capacity
  set(id: string, module: Module): void {
    const estimatedSize = this.estimateExportsSize(module.exports);

    // Evict if at capacity (memory-based primary, count-based secondary)
    while (
      (this.totalMemoryBytes + estimatedSize > this.maxMemoryBytes ||
        this.cache.size >= this.maxModules) &&
      this.canEvict()
    ) {
      this.evictLRU();
    }

    this.cache.set(id, {
      module,
      lastAccessed: Date.now(),
      estimatedSize,
    });
    this.totalMemoryBytes += estimatedSize;
  }

  // delete module from cache, return the estimated size freed
  delete(id: string): number {
    const entry = this.cache.get(id);
    if (entry && !this.preloadedIds.has(id)) {
      this.totalMemoryBytes -= entry.estimatedSize;
      this.cache.delete(id);
      return entry.estimatedSize;
    }
    this.cache.delete(id);
    return 0;
  }

  // check if there's a non-preloaded module to evict
  private canEvict(): boolean {
    for (const [id] of this.cache) {
      if (!this.preloadedIds.has(id)) {
        return true;
      }
    }
    return false;
  }

  // evict least recently used non-preloaded module
  // O(p) where p = number of preloaded modules at start of Map
  private evictLRU(): void {
    // First entry in Map is oldest (LRU) due to insertion order
    for (const [id, entry] of this.cache) {
      if (!this.preloadedIds.has(id)) {
        this.cache.delete(id);
        this.totalMemoryBytes -= entry.estimatedSize;
        // Notify registry to clean up metadata
        this.onEvict?.(id);
        return;
      }
    }
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
      // Rough estimate for function size (source code length if available)
      const funcString = exports.toString();
      return funcString.length * 2 + 100;
    }

    if (typeof exports === 'object') {
      // Rough estimate: traverse one level deep
      let size = 40; // object overhead
      const obj = exports as Record<string, unknown>;
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          size += key.length * 2 + 8; // key + pointer
          const value = obj[key];
          if (typeof value === 'string') {
            size += value.length * 2;
          } else if (typeof value === 'function') {
            size += value.toString().length * 2 + 100;
          } else if (typeof value === 'object' && value !== null) {
            size += 200; // rough estimate for nested objects
          } else {
            size += 8; // primitive
          }
        }
      }
      return size;
    }

    return 8; // primitive
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
    for (const [id, entry] of this.cache) {
      if (!this.preloadedIds.has(id)) {
        this.totalMemoryBytes -= entry.estimatedSize;
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
    this.totalMemoryBytes = 0;
  }
}
