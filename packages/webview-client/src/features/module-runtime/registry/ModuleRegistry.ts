// packages/webview-app/src/module-system/registry/ModuleRegistry.ts
// facade over ModuleCache, StyleCache & DependencyTracker subsystems

import type { Module } from '../types';
import { ModuleCache, type ModuleCacheConfig } from './ModuleCache';
import { StyleCache, type StyleCacheConfig } from './StyleCache';
import { DependencyTracker } from './DependencyTracker';

// lru configuration options
export interface LRUConfig extends ModuleCacheConfig, StyleCacheConfig {}

// coordinate module cache, style cache & dependency tracker subsystems
// - ModuleCache: lru cache w/ memory tracking & pending fetches
// - StyleCache: reference-counted style tracking w/ dual-map lru
// - DependencyTracker: dependency graph & resolution map
export class ModuleRegistry {
  private moduleCache = new ModuleCache();
  private styleCache = new StyleCache();
  private dependencyTracker = new DependencyTracker();

  constructor() {
    // wire up eviction callback for coordinated cleanup
    this.moduleCache.onEvict = (id: string) => {
      this.dependencyTracker.cleanDependentsFor(id);
      this.dependencyTracker.cleanResolutionMapFor(id);
    };
  }

  // lru configuration

  // configure lru limits for modules & styles
  configureLRU(options: LRUConfig): void {
    this.moduleCache.configure(options);
    this.styleCache.configure(options);
  }

  // module cache operations (delegated to ModuleCache)

  // preload module (for built-in modules like React)
  // preloaded modules are protected from eviction & don't count against memory limit
  preload(id: string, exports: unknown): void {
    this.moduleCache.preload(id, exports);
  }

  // get cached module (update access time for lru)
  get(id: string): Module | undefined {
    return this.moduleCache.get(id);
  }

  // check if module is cached
  has(id: string): boolean {
    return this.moduleCache.has(id);
  }

  // check if module is preloaded (protected from eviction)
  isPreloaded(id: string): boolean {
    return this.moduleCache.isPreloaded(id);
  }

  // set module in cache w/ lru eviction (memory-based + count-based)
  set(id: string, module: Module): void {
    this.moduleCache.set(id, module);
  }

  // pending fetch operations (delegated to ModuleCache)

  // get pending fetch promise (for circular dependency detection)
  getPending(id: string): Promise<Module> | undefined {
    return this.moduleCache.getPending(id);
  }

  // set pending fetch promise
  setPending(id: string, promise: Promise<Module>): void {
    this.moduleCache.setPending(id, promise);
  }

  // clear pending fetch
  clearPending(id: string): void {
    this.moduleCache.clearPending(id);
  }

  // invalidation (coordinated across subsystems)

  // invalidate cached module (for hot reload)
  // clean up all related metadata to prevent memory leaks
  invalidate(id: string): void {
    // delete from cache (return freed bytes for non-preloaded)
    this.moduleCache.delete(id);
    // clean up dependency tracking
    this.dependencyTracker.cleanDependentsFor(id);
    this.dependencyTracker.cleanResolutionMapFor(id);
    // clean up pending fetch
    this.moduleCache.clearPending(id);
  }

  // invalidate module & all modules that depend on it (cascade)
  // clean up all related metadata to prevent memory leaks
  invalidateWithDependents(id: string): Set<string> {
    const invalidated = this.dependencyTracker.invalidateWithDependents(id);

    // delete all invalidated modules from cache
    for (const moduleId of invalidated) {
      this.moduleCache.delete(moduleId);
      this.moduleCache.clearPending(moduleId);
    }

    return invalidated;
  }

  // dependency operations (delegated to DependencyTracker)

  // record that moduleId depends on dependsOnId
  addDependency(moduleId: string, dependsOnId: string): void {
    this.dependencyTracker.addDependency(moduleId, dependsOnId);
  }

  // clear the dependency graph (but keep module cache)
  clearDependencies(): void {
    this.dependencyTracker.clearDependencies();
  }

  // resolution map operations (delegated to DependencyTracker)

  // register a resolved path for a (parent, request) pair
  setResolution(parentId: string, request: string, fsPath: string): void {
    this.dependencyTracker.setResolution(parentId, request, fsPath);
  }

  // get resolved fsPath for a (parent, request) pair
  getResolution(parentId: string, request: string): string | undefined {
    return this.dependencyTracker.getResolution(parentId, request);
  }

  // clear resolution map (called on reset)
  clearResolutions(): void {
    this.dependencyTracker.clearResolutions();
  }

  // style operations (delegated to StyleCache)

  // check if CSS has been injected for module
  hasInjectedStyle(id: string): boolean {
    return this.styleCache.hasInjectedStyle(id);
  }

  // mark CSS as injected for module (w/ reference counting)
  markStyleInjected(id: string): void {
    this.styleCache.markStyleInjected(id);
  }

  // decrement style reference count
  decrementStyleRef(id: string): void {
    this.styleCache.decrementStyleRef(id);
  }

  // clear injected styles tracking
  clearInjectedStyles(): void {
    this.styleCache.clear();
  }

  // remove style tracking for a single module (for incremental updates)
  unmarkStyleInjected(id: string): void {
    this.styleCache.unmarkStyleInjected(id);
  }

  // bulk operations (coordinated across subsystems)

  // clear all cached modules except preloaded ones
  clearNonPreloaded(_preloadedIds?: string[]): void {
    this.moduleCache.clearNonPreloaded();
    this.dependencyTracker.clear();
  }

  // clear all cached modules & metadata
  clear(): void {
    this.moduleCache.clear();
    this.styleCache.clear();
    this.dependencyTracker.clear();
  }

  // statistics (aggregated from subsystems)

  // get cache statistics (for debugging/monitoring)
  getStats(): {
    modules: number;
    styles: number;
    preloaded: number;
    pending: number;
    resolutions: number;
    dependents: number;
    memoryBytes: number;
  } {
    const depStats = this.dependencyTracker.getStats();
    return {
      modules: this.moduleCache.size,
      styles: this.styleCache.size,
      preloaded: this.moduleCache.preloadedCount,
      pending: this.moduleCache.pendingCount,
      resolutions: depStats.resolutions,
      dependents: depStats.dependents,
      memoryBytes: this.moduleCache.memoryBytes,
    };
  }
}

// singleton registry instance
export const registry = new ModuleRegistry();
