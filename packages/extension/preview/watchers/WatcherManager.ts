// packages/extension/preview/watchers/WatcherManager.ts
// coordinate all watchers w/ unified lifecycle management

import type { Disposable } from 'vscode';
import { debug } from '../../logging';
import type { IWatcher } from './types';

// coordinate all watchers w/ unified lifecycle management.
// provides a central place to register, start, stop, & dispose watchers.
export class WatcherManager implements Disposable {
  private watchers = new Map<string, IWatcher>();
  private readyGate: Promise<void> | null = null;

  // register a watcher w/ a unique name
  register(name: string, watcher: IWatcher): void {
    // dispose existing watcher w/ same name if present
    const existing = this.watchers.get(name);
    if (existing) {
      debug(`[WATCHER-MANAGER] Replacing existing watcher: ${name}`);
      existing.dispose();
    }

    this.watchers.set(name, watcher);
    debug(`[WATCHER-MANAGER] Registered watcher: ${name}`);
  }

  // get a registered watcher by name
  get<T extends IWatcher>(name: string): T | undefined {
    return this.watchers.get(name) as T | undefined;
  }

  // check if a watcher is registered
  has(name: string): boolean {
    return this.watchers.has(name);
  }

  // unregister & dispose a watcher (returns true if found & removed)
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
  // Returns a promise that resolves when all watchers have started.
  async startAll(): Promise<void> {
    const startPromises = Array.from(this.watchers.entries())
      .filter(([, watcher]) => !watcher.isActive())
      .map(async ([name, watcher]) => {
        await watcher.start();
        debug(`[WATCHER-MANAGER] Started: ${name}`);
      });
    await Promise.all(startPromises);
  }

  // Wait for all watchers to report ready (Promise-based, no polling).
  async waitForAllReady(timeoutMs?: number): Promise<void> {
    const waitPromises = Array.from(this.watchers.entries()).map(
      async ([name, watcher]) => {
        await watcher.waitForReady(timeoutMs);
        debug(`[WATCHER-MANAGER] Ready: ${name}`);
      }
    );
    await Promise.all(waitPromises);
  }

  // Get the ready state of all watchers.
  getReadyState(): Map<string, boolean> {
    return new Map(
      Array.from(this.watchers.entries()).map(([name, watcher]) => [
        name,
        watcher.isReady(),
      ])
    );
  }

  // Set a ready gate that watcher callbacks should wait for.
  // Used to prevent callbacks from firing before webview is ready.
  setReadyGate(gate: Promise<void>): void {
    this.readyGate = gate;
  }

  // Wait for the ready gate to resolve.
  // Watcher callbacks should call this before processing events.
  async waitForGate(): Promise<void> {
    if (this.readyGate) {
      await this.readyGate;
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

  // Refresh a specific watcher (stop + start).
  async refresh(name: string): Promise<void> {
    const watcher = this.watchers.get(name);
    if (watcher) {
      watcher.stop();
      await watcher.start();
      debug(`[WATCHER-MANAGER] Refreshed: ${name}`);
    }
  }

  // Refresh all watchers (stop + start each).
  async refreshAll(): Promise<void> {
    for (const [name, watcher] of this.watchers) {
      if (watcher.isActive()) {
        watcher.stop();
        await watcher.start();
        debug(`[WATCHER-MANAGER] Refreshed: ${name}`);
      }
    }
  }

  // Check if all watchers are ready.
  areAllReady(): boolean {
    for (const watcher of this.watchers.values()) {
      if (!watcher.isReady()) {
        return false;
      }
    }
    return true;
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
