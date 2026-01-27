// packages/webview-app/src/module-system/registry/ModuleRegistry.ts
// cache evaluated modules w/ LRU eviction (count + memory based) & track pending fetches

import type { Module } from '../types';

// LRU configuration defaults
const DEFAULT_MAX_MODULES = 500;
const DEFAULT_MAX_STYLES = 100;
const DEFAULT_MAX_MEMORY_BYTES = 50 * 1024 * 1024; // 50MB

// Cache entry w/ access tracking for LRU and memory tracking
interface CacheEntry {
  module: Module;
  lastAccessed: number;
  estimatedSize: number; // estimated memory footprint in bytes
}

// Style tracking w/ reference counting
interface StyleEntry {
  refCount: number;
  lastAccessed: number;
}

export class ModuleRegistry {
  private cache: Map<string, CacheEntry> = new Map();
  private pendingFetches: Map<string, Promise<Module>> = new Map();
  // Dual-map style tracking for O(1) LRU eviction:
  // - referencedStyles: styles with refCount > 0 (not evictable)
  // - unreferencedStyles: styles with refCount === 0 (eviction candidates, LRU order)
  private referencedStyles: Map<string, StyleEntry> = new Map();
  private unreferencedStyles: Map<string, StyleEntry> = new Map();
  // map (parentId, request) -> resolved fsPath for relative imports
  private resolutionMap: Map<string, string> = new Map();
  // Reverse indexes for O(k) cleanup instead of O(n) full scan:
  // - parentToResolutionKeys: moduleId -> Set of resolution keys where moduleId is parent
  // - targetToResolutionKeys: moduleId -> Set of resolution keys where moduleId is target (value)
  private parentToResolutionKeys: Map<string, Set<string>> = new Map();
  private targetToResolutionKeys: Map<string, Set<string>> = new Map();
  // reverse dependency graph: moduleId -> set of modules that depend on it
  private dependents: Map<string, Set<string>> = new Map();

  // LRU configuration
  private maxModules = DEFAULT_MAX_MODULES;
  private maxStyles = DEFAULT_MAX_STYLES;
  private maxMemoryBytes = DEFAULT_MAX_MEMORY_BYTES;
  private preloadedIds: Set<string> = new Set();

  // Memory tracking
  private totalMemoryBytes = 0;

  // Configure LRU limits
  configureLRU(options: {
    maxModules?: number;
    maxStyles?: number;
    maxMemoryBytes?: number;
  }): void {
    if (options.maxModules !== undefined) {
      this.maxModules = options.maxModules;
    }
    if (options.maxStyles !== undefined) {
      this.maxStyles = options.maxStyles;
    }
    if (options.maxMemoryBytes !== undefined) {
      this.maxMemoryBytes = options.maxMemoryBytes;
    }
  }

  // preload module (for built-in modules like React)
  // preloaded modules are protected from eviction and don't count against memory limit
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

  // get cached module (updates access time for LRU)
  // Uses delete + re-insert to maintain Map insertion order (O(1) LRU)
  // JavaScript Map preserves insertion order, so most recently accessed is at end
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

  // set module in cache w/ LRU eviction (memory-based + count-based)
  set(id: string, module: Module): void {
    const estimatedSize = this.estimateExportsSize(module.exports);

    // Evict if at capacity (memory-based primary, count-based secondary)
    // Don't evict preloaded modules
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

  // check if there's a non-preloaded module to evict
  private canEvict(): boolean {
    for (const [id] of this.cache) {
      if (!this.preloadedIds.has(id)) {
        return true;
      }
    }
    return false;
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

  // remove all resolutionMap entries for moduleId (as parent or target)
  // O(k) via reverse indexes instead of O(n) full scan
  private cleanResolutionMapFor(moduleId: string): void {
    // Clean entries where moduleId is parent
    const parentKeys = this.parentToResolutionKeys.get(moduleId);
    if (parentKeys) {
      for (const key of parentKeys) {
        const target = this.resolutionMap.get(key);
        if (target) {
          this.targetToResolutionKeys.get(target)?.delete(key);
        }
        this.resolutionMap.delete(key);
      }
      this.parentToResolutionKeys.delete(moduleId);
    }

    // Clean entries where moduleId is target
    const targetKeys = this.targetToResolutionKeys.get(moduleId);
    if (targetKeys) {
      for (const key of targetKeys) {
        const parentId = key.split('\0')[0];
        this.parentToResolutionKeys.get(parentId)?.delete(key);
        this.resolutionMap.delete(key);
      }
      this.targetToResolutionKeys.delete(moduleId);
    }
  }

  // remove module from all dependents sets & delete its own entry
  private cleanDependentsFor(moduleId: string): void {
    // Remove this module's entry as a dependency target
    this.dependents.delete(moduleId);

    // Remove this module from all other modules' dependent sets
    for (const [, deps] of this.dependents) {
      deps.delete(moduleId);
    }
  }

  // evict least recently used non-preloaded module
  // O(p) where p = number of preloaded modules at start of Map (constant in practice)
  // Since get() moves accessed entries to the end, first entries are oldest
  private evictLRU(): void {
    // First entry in Map is oldest (LRU) due to insertion order
    for (const [id, entry] of this.cache) {
      if (!this.preloadedIds.has(id)) {
        this.cache.delete(id);
        this.totalMemoryBytes -= entry.estimatedSize; // Update memory tracking
        // Clean up all related metadata (fixes memory leak)
        this.cleanDependentsFor(id);
        this.cleanResolutionMapFor(id);
        // only evict one
        return;
      }
    }
  }

  // get pending fetch promise (for circular dependency detection)
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

  // invalidate cached module (for hot reload)
  // cleans up all related metadata to prevent memory leaks
  invalidate(id: string): void {
    const entry = this.cache.get(id);
    if (entry && !this.preloadedIds.has(id)) {
      this.totalMemoryBytes -= entry.estimatedSize;
    }
    this.cache.delete(id);
    this.cleanDependentsFor(id);
    this.cleanResolutionMapFor(id);
    this.pendingFetches.delete(id);
  }

  // record that moduleId depends on dependsOnId
  addDependency(moduleId: string, dependsOnId: string): void {
    if (!this.dependents.has(dependsOnId)) {
      this.dependents.set(dependsOnId, new Set());
    }
    this.dependents.get(dependsOnId)!.add(moduleId);
  }

  // invalidate module & all modules that depend on it (cascade)
  // cleans up all related metadata to prevent memory leaks
  invalidateWithDependents(id: string): Set<string> {
    const invalidated = new Set<string>();
    const queue = [id];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (invalidated.has(current)) {
        continue;
      }

      // Update memory tracking before deleting
      const entry = this.cache.get(current);
      if (entry && !this.preloadedIds.has(current)) {
        this.totalMemoryBytes -= entry.estimatedSize;
      }

      // delete from cache
      this.cache.delete(current);
      invalidated.add(current);

      // queue all modules that depend on this one
      // (get deps BEFORE cleaning, needed for cascade traversal)
      const deps = this.dependents.get(current);
      if (deps) {
        for (const dep of deps) {
          if (!invalidated.has(dep)) {
            queue.push(dep);
          }
        }
      }
    }

    // Clean up all metadata for ALL invalidated modules (batch cleanup)
    for (const moduleId of invalidated) {
      this.cleanDependentsFor(moduleId);
      this.cleanResolutionMapFor(moduleId);
      this.pendingFetches.delete(moduleId);
    }

    return invalidated;
  }

  // clear the dependency graph (but keep module cache)
  clearDependencies(): void {
    this.dependents.clear();
  }

  // clear all cached modules except preloaded ones
  clearNonPreloaded(preloadedIds: string[]): void {
    const preloadedSet = new Set(preloadedIds);
    for (const [id, entry] of this.cache) {
      if (!preloadedSet.has(id)) {
        this.totalMemoryBytes -= entry.estimatedSize;
        this.cache.delete(id);
      }
    }
    this.pendingFetches.clear();
    this.resolutionMap.clear();
    this.parentToResolutionKeys.clear();
    this.targetToResolutionKeys.clear();
    this.dependents.clear();
  }

  // clear all cached modules
  clear(): void {
    this.cache.clear();
    this.pendingFetches.clear();
    this.resolutionMap.clear();
    this.parentToResolutionKeys.clear();
    this.targetToResolutionKeys.clear();
    this.dependents.clear();
    this.referencedStyles.clear();
    this.unreferencedStyles.clear();
    this.preloadedIds.clear();
    this.totalMemoryBytes = 0;
  }

  // check if CSS has been injected for module
  hasInjectedStyle(id: string): boolean {
    return this.referencedStyles.has(id) || this.unreferencedStyles.has(id);
  }

  // mark CSS as injected for module (w/ reference counting)
  // uses dual-map architecture for O(1) LRU eviction
  markStyleInjected(id: string): void {
    // Check both maps for existing entry
    const existingReferenced = this.referencedStyles.get(id);
    const existingUnreferenced = this.unreferencedStyles.get(id);
    const existing = existingReferenced ?? existingUnreferenced;

    if (existing) {
      existing.refCount++;
      existing.lastAccessed = Date.now();
      // If was in unreferenced, move to referenced
      if (existingUnreferenced) {
        this.unreferencedStyles.delete(id);
        this.referencedStyles.set(id, existing);
      }
    } else {
      // Evict if at capacity (only unreferenced can be evicted)
      while (
        this.referencedStyles.size + this.unreferencedStyles.size >= this.maxStyles &&
        this.unreferencedStyles.size > 0
      ) {
        if (!this.evictUnreferencedStyle()) {
          break;
        }
      }
      // New style starts in referenced map
      this.referencedStyles.set(id, { refCount: 1, lastAccessed: Date.now() });
    }
  }

  // Decrement style reference count
  // Moves style to unreferenced map when refCount hits 0 (for O(1) LRU eviction)
  decrementStyleRef(id: string): void {
    const entry = this.referencedStyles.get(id);
    if (entry) {
      entry.refCount = Math.max(0, entry.refCount - 1);
      if (entry.refCount === 0) {
        // Move to unreferenced (at end = newest for LRU)
        this.referencedStyles.delete(id);
        this.unreferencedStyles.set(id, entry);
      }
    }
    // If already in unreferencedStyles, just update (already unreferenced)
    const unreferenced = this.unreferencedStyles.get(id);
    if (unreferenced && !entry) {
      unreferenced.refCount = Math.max(0, unreferenced.refCount - 1);
    }
  }

  // Evict oldest unreferenced style - O(1) via Map insertion order
  // First entry in unreferencedStyles is the LRU candidate
  private evictUnreferencedStyle(): boolean {
    const firstKey = this.unreferencedStyles.keys().next();
    if (!firstKey.done) {
      this.unreferencedStyles.delete(firstKey.value);
      return true;
    }
    return false;
  }

  // clear injected styles tracking
  clearInjectedStyles(): void {
    this.referencedStyles.clear();
    this.unreferencedStyles.clear();
  }

  // remove style tracking for a single module (for incremental updates)
  unmarkStyleInjected(id: string): void {
    this.referencedStyles.delete(id);
    this.unreferencedStyles.delete(id);
  }

  // create key for resolution map
  private makeResolutionKey(parentId: string, request: string): string {
    return `${parentId}\0${request}`;
  }

  // register a resolved path for a (parent, request) pair
  // maintains reverse indexes for O(k) cleanup
  setResolution(parentId: string, request: string, fsPath: string): void {
    const key = this.makeResolutionKey(parentId, request);

    // Clean up old target mapping if this key existed
    const oldTarget = this.resolutionMap.get(key);
    if (oldTarget) {
      this.targetToResolutionKeys.get(oldTarget)?.delete(key);
    }

    // Set the resolution
    this.resolutionMap.set(key, fsPath);

    // Update parent index
    if (!this.parentToResolutionKeys.has(parentId)) {
      this.parentToResolutionKeys.set(parentId, new Set());
    }
    this.parentToResolutionKeys.get(parentId)!.add(key);

    // Update target index
    if (!this.targetToResolutionKeys.has(fsPath)) {
      this.targetToResolutionKeys.set(fsPath, new Set());
    }
    this.targetToResolutionKeys.get(fsPath)!.add(key);
  }

  // get resolved fsPath for a (parent, request) pair
  getResolution(parentId: string, request: string): string | undefined {
    const key = this.makeResolutionKey(parentId, request);
    return this.resolutionMap.get(key);
  }

  // clear resolution map (called on reset)
  clearResolutions(): void {
    this.resolutionMap.clear();
    this.parentToResolutionKeys.clear();
    this.targetToResolutionKeys.clear();
  }

  // Get cache statistics (for debugging/monitoring)
  getStats(): {
    modules: number;
    styles: number;
    preloaded: number;
    pending: number;
    resolutions: number;
    dependents: number;
    memoryBytes: number;
  } {
    return {
      modules: this.cache.size,
      styles: this.referencedStyles.size + this.unreferencedStyles.size,
      preloaded: this.preloadedIds.size,
      pending: this.pendingFetches.size,
      resolutions: this.resolutionMap.size,
      dependents: this.dependents.size,
      memoryBytes: this.totalMemoryBytes,
    };
  }
}

// singleton registry instance
export const registry = new ModuleRegistry();
