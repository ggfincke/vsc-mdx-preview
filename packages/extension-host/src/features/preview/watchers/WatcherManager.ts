// packages/extension/preview/watchers/WatcherManager.ts
// coordinate all watchers w/ unified lifecycle management

import type { Disposable } from 'vscode';
import { createTaggedLogger } from '../../../shared/logging/logger';
import { LogTags } from '@mdx-preview/contracts';

// module-level tagged logger
const log = createTaggedLogger(LogTags.WATCHER_MANAGER);
import type { IWatcher } from '../../types';

// coordinate all watchers w/ unified lifecycle management
export class WatcherManager implements Disposable {
  private watchers = new Map<string, IWatcher>();
  private readyGate: Promise<void> | null = null;

  // register a watcher w/ a unique name
  register(name: string, watcher: IWatcher): void {
    // dispose existing watcher w/ same name if present
    const existing = this.watchers.get(name);
    if (existing) {
      log.debug(`Replacing existing watcher: ${name}`);
      existing.dispose();
    }

    this.watchers.set(name, watcher);
    log.debug(`Registered watcher: ${name}`);
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
      log.debug(`Unregistered watcher: ${name}`);
      return true;
    }
    return false;
  }

  // start all registered watchers (resolves when all started)
  async startAll(): Promise<void> {
    const startPromises = Array.from(this.watchers.entries())
      .filter(([, watcher]) => !watcher.isActive())
      .map(async ([name, watcher]) => {
        await watcher.start();
        log.debug(`Started: ${name}`);
      });
    await Promise.all(startPromises);
  }

  // wait for all watchers to report ready (Promise-based, no polling)
  async waitForAllReady(timeoutMs?: number): Promise<void> {
    const waitPromises = Array.from(this.watchers.entries()).map(
      async ([name, watcher]) => {
        await watcher.waitForReady(timeoutMs);
        log.debug(`Ready: ${name}`);
      }
    );
    await Promise.all(waitPromises);
  }

  // get the ready state of all watchers
  getReadyState(): Map<string, boolean> {
    return new Map(
      Array.from(this.watchers.entries()).map(([name, watcher]) => [
        name,
        watcher.isReady(),
      ])
    );
  }

  // set ready gate to prevent callbacks from firing before webview is ready
  setReadyGate(gate: Promise<void>): void {
    this.readyGate = gate;
  }

  // wait for ready gate (watcher callbacks call before processing events)
  async waitForGate(): Promise<void> {
    if (this.readyGate) {
      await this.readyGate;
    }
  }

  // stop all registered watchers w/out disposing them
  stopAll(): void {
    for (const [name, watcher] of this.watchers) {
      if (watcher.isActive()) {
        watcher.stop();
        log.debug(`Stopped: ${name}`);
      }
    }
  }

  // refresh a specific watcher (stop + start)
  async refresh(name: string): Promise<void> {
    const watcher = this.watchers.get(name);
    if (watcher) {
      watcher.stop();
      await watcher.start();
      log.debug(`Refreshed: ${name}`);
    }
  }

  // refresh all watchers (stop + start each)
  async refreshAll(): Promise<void> {
    for (const [name, watcher] of this.watchers) {
      if (watcher.isActive()) {
        watcher.stop();
        await watcher.start();
        log.debug(`Refreshed: ${name}`);
      }
    }
  }

  // check if all watchers are ready
  areAllReady(): boolean {
    for (const watcher of this.watchers.values()) {
      if (!watcher.isReady()) {
        return false;
      }
    }
    return true;
  }

  // get the names of all registered watchers
  getNames(): string[] {
    return Array.from(this.watchers.keys());
  }

  // get the count of registered watchers
  get size(): number {
    return this.watchers.size;
  }

  // dispose all watchers & clear the registry
  dispose(): void {
    for (const [name, watcher] of this.watchers) {
      log.debug(`Disposing: ${name}`);
      watcher.dispose();
    }
    this.watchers.clear();
    log.debug('All watchers disposed');
  }
}
