// packages/webview-app/src/module-system/registry/ModuleRegistry.ts
// cache evaluated modules w/ LRU eviction & track pending fetches

import type { Module } from '../types';

// LRU configuration defaults
const DEFAULT_MAX_MODULES = 500;
const DEFAULT_MAX_STYLES = 100;

// Cache entry w/ access tracking for LRU
interface CacheEntry {
  module: Module;
  lastAccessed: number;
}

// Style tracking w/ reference counting
interface StyleEntry {
  refCount: number;
  lastAccessed: number;
}

export class ModuleRegistry {
  private cache: Map<string, CacheEntry> = new Map();
  private pendingFetches: Map<string, Promise<Module>> = new Map();
  private injectedStyles: Map<string, StyleEntry> = new Map();
  // map (parentId, request) -> resolved fsPath for relative imports
  private resolutionMap: Map<string, string> = new Map();
  // reverse dependency graph: moduleId -> set of modules that depend on it
  private dependents: Map<string, Set<string>> = new Map();

  // LRU configuration
  private maxModules = DEFAULT_MAX_MODULES;
  private maxStyles = DEFAULT_MAX_STYLES;
  private preloadedIds: Set<string> = new Set();

  // Configure LRU limits
  configureLRU(options: { maxModules?: number; maxStyles?: number }): void {
    if (options.maxModules !== undefined) {
      this.maxModules = options.maxModules;
    }
    if (options.maxStyles !== undefined) {
      this.maxStyles = options.maxStyles;
    }
  }

  // preload module (for built-in modules like React)
  preload(id: string, exports: unknown): void {
    this.preloadedIds.add(id);
    this.cache.set(id, {
      module: { id, exports, loaded: true },
      lastAccessed: Date.now(),
    });
  }

  // get cached module (updates access time for LRU)
  get(id: string): Module | undefined {
    const entry = this.cache.get(id);
    if (entry) {
      entry.lastAccessed = Date.now();
      return entry.module;
    }
    return undefined;
  }

  // check if module is cached
  has(id: string): boolean {
    return this.cache.has(id);
  }

  // set module in cache w/ LRU eviction
  set(id: string, module: Module): void {
    // Evict if at capacity (don't evict preloaded)
    while (this.cache.size >= this.maxModules && this.canEvict()) {
      this.evictLRU();
    }

    this.cache.set(id, {
      module,
      lastAccessed: Date.now(),
    });
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

  // remove all resolutionMap entries for moduleId (as parent or target)
  private cleanResolutionMapFor(moduleId: string): void {
    for (const [key, value] of this.resolutionMap) {
      // key format: "parentId\0request"
      const parentId = key.split('\0')[0];
      if (parentId === moduleId || value === moduleId) {
        this.resolutionMap.delete(key);
      }
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
  private evictLRU(): void {
    let oldestId: string | null = null;
    let oldestTime = Infinity;

    for (const [id, entry] of this.cache) {
      if (!this.preloadedIds.has(id) && entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestId = id;
      }
    }

    if (oldestId) {
      this.cache.delete(oldestId);
      // Clean up all related metadata (fixes memory leak)
      this.cleanDependentsFor(oldestId);
      this.cleanResolutionMapFor(oldestId);
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
    for (const [id] of this.cache) {
      if (!preloadedSet.has(id)) {
        this.cache.delete(id);
      }
    }
    this.pendingFetches.clear();
    this.resolutionMap.clear();
    this.dependents.clear();
  }

  // clear all cached modules
  clear(): void {
    this.cache.clear();
    this.pendingFetches.clear();
    this.resolutionMap.clear();
    this.dependents.clear();
    this.injectedStyles.clear();
    this.preloadedIds.clear();
  }

  // check if CSS has been injected for module
  hasInjectedStyle(id: string): boolean {
    return this.injectedStyles.has(id);
  }

  // mark CSS as injected for module (w/ reference counting)
  markStyleInjected(id: string): void {
    const existing = this.injectedStyles.get(id);
    if (existing) {
      existing.refCount++;
      existing.lastAccessed = Date.now();
    } else {
      // Evict old unreferenced styles if at capacity
      while (this.injectedStyles.size >= this.maxStyles) {
        // no more unreferenced styles to evict
        if (!this.evictUnreferencedStyle()) {
          break;
        }
      }
      this.injectedStyles.set(id, { refCount: 1, lastAccessed: Date.now() });
    }
  }

  // Decrement style reference count
  decrementStyleRef(id: string): void {
    const entry = this.injectedStyles.get(id);
    if (entry) {
      entry.refCount = Math.max(0, entry.refCount - 1);
    }
  }

  // Evict oldest unreferenced style
  private evictUnreferencedStyle(): boolean {
    let oldestId: string | null = null;
    let oldestTime = Infinity;

    for (const [id, entry] of this.injectedStyles) {
      if (entry.refCount === 0 && entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestId = id;
      }
    }

    if (oldestId) {
      this.injectedStyles.delete(oldestId);
      return true;
    }
    return false;
  }

  // clear injected styles tracking
  clearInjectedStyles(): void {
    this.injectedStyles.clear();
  }

  // create key for resolution map
  private makeResolutionKey(parentId: string, request: string): string {
    return `${parentId}\0${request}`;
  }

  // register a resolved path for a (parent, request) pair
  setResolution(parentId: string, request: string, fsPath: string): void {
    const key = this.makeResolutionKey(parentId, request);
    this.resolutionMap.set(key, fsPath);
  }

  // get resolved fsPath for a (parent, request) pair
  getResolution(parentId: string, request: string): string | undefined {
    const key = this.makeResolutionKey(parentId, request);
    return this.resolutionMap.get(key);
  }

  // clear resolution map (called on reset)
  clearResolutions(): void {
    this.resolutionMap.clear();
  }

  // Get cache statistics (for debugging/monitoring)
  getStats(): {
    modules: number;
    styles: number;
    preloaded: number;
    pending: number;
    resolutions: number;
    dependents: number;
  } {
    return {
      modules: this.cache.size,
      styles: this.injectedStyles.size,
      preloaded: this.preloadedIds.size,
      pending: this.pendingFetches.size,
      resolutions: this.resolutionMap.size,
      dependents: this.dependents.size,
    };
  }
}

// singleton registry instance
export const registry = new ModuleRegistry();
