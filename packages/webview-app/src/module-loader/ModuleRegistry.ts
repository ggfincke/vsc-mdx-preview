// packages/webview-app/src/module-loader/ModuleRegistry.ts
// cache evaluated modules & track pending fetches for circular dependency handling

import type { Module } from './types';

export class ModuleRegistry {
  private cache: Map<string, Module> = new Map();
  private pendingFetches: Map<string, Promise<Module>> = new Map();
  private injectedStyles: Set<string> = new Set();

  // preload module (for built-in modules like React)
  preload(id: string, exports: any): void {
    this.cache.set(id, {
      id,
      exports,
      loaded: true,
    });
  }

  // get cached module
  get(id: string): Module | undefined {
    return this.cache.get(id);
  }

  // check if module is cached
  has(id: string): boolean {
    return this.cache.has(id);
  }

  // set module in cache
  set(id: string, module: Module): void {
    this.cache.set(id, module);
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
  invalidate(id: string): void {
    this.cache.delete(id);
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
  }

  // clear all cached modules
  clear(): void {
    this.cache.clear();
    this.pendingFetches.clear();
  }

  // check if CSS has been injected for module
  hasInjectedStyle(id: string): boolean {
    return this.injectedStyles.has(id);
  }

  // mark CSS as injected for module
  markStyleInjected(id: string): void {
    this.injectedStyles.add(id);
  }

  // clear injected styles tracking
  clearInjectedStyles(): void {
    this.injectedStyles.clear();
  }
}

// singleton registry instance
export const registry = new ModuleRegistry();
