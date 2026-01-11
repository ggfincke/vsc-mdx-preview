// packages/extension/preview/watchers/WatcherManager.ts
// Coordinate all watchers with unified lifecycle management

import type { Disposable } from 'vscode';
import { debug } from '../../logging';
import type { IWatcher } from './types';

// Coordinate all watchers w/ unified lifecycle management.
// Provides a central place to register, start, stop, & dispose watchers.
export class WatcherManager implements Disposable {
  private watchers = new Map<string, IWatcher>();

  // Register a watcher w/ a unique name.
  // @param name - Unique identifier for the watcher
  // @param watcher - The watcher instance to register
  register(name: string, watcher: IWatcher): void {
    // Dispose existing watcher with same name if present
    const existing = this.watchers.get(name);
    if (existing) {
      debug(`[WATCHER-MANAGER] Replacing existing watcher: ${name}`);
      existing.dispose();
    }

    this.watchers.set(name, watcher);
    debug(`[WATCHER-MANAGER] Registered watcher: ${name}`);
  }

  // Get a registered watcher by name.
  // @param name - The watcher name
  // @returns The watcher instance or undefined if not found
  get<T extends IWatcher>(name: string): T | undefined {
    return this.watchers.get(name) as T | undefined;
  }

  // Check if a watcher is registered.
  // @param name - The watcher name
  has(name: string): boolean {
    return this.watchers.has(name);
  }

  // Unregister & dispose a watcher.
  // @param name - The watcher name
  // @returns true if the watcher was found & removed
  unregister(name: string): boolean {
    const watcher = this.watchers.get(name);
    if (watcher) {
      watcher.dispose();
      this.watchers.delete(name);
      debug(`[WATCHER-MANAGER] Unregistered watcher: ${name}`);
      return true;
    }
    return false;
  }

  // Start all registered watchers.
  startAll(): void {
    for (const [name, watcher] of this.watchers) {
      if (!watcher.isActive()) {
        watcher.start();
        debug(`[WATCHER-MANAGER] Started: ${name}`);
      }
    }
  }

  // Stop all registered watchers without disposing them.
  stopAll(): void {
    for (const [name, watcher] of this.watchers) {
      if (watcher.isActive()) {
        watcher.stop();
        debug(`[WATCHER-MANAGER] Stopped: ${name}`);
      }
    }
  }

  // Get the names of all registered watchers.
  getNames(): string[] {
    return Array.from(this.watchers.keys());
  }

  // Get the count of registered watchers.
  get size(): number {
    return this.watchers.size;
  }

  // Dispose all watchers & clear the registry.
  dispose(): void {
    for (const [name, watcher] of this.watchers) {
      debug(`[WATCHER-MANAGER] Disposing: ${name}`);
      watcher.dispose();
    }
    this.watchers.clear();
    debug('[WATCHER-MANAGER] All watchers disposed');
  }
}
