// packages/extension-host/src/features/preview/watchers/EventSubscriptionWatcher.ts
// IWatcher adapter for event-based subscriptions (non-file watchers)

import type * as vscode from 'vscode';
import type { LogTag } from '@mdx-preview/contracts';
import { createTaggedLogger } from '../../../shared/logging/logger';
import type { IWatcher } from '../../types';

export interface EventSubscriptionConfig {
  // log tag for debug output
  logTag: LogTag;
  // subscribe to events & return a disposable for cleanup
  subscribe: () => vscode.Disposable;
}

// adapt event subscriptions to the IWatcher interface
// use for config change subscriptions & other non-file-watcher event sources
export class EventSubscriptionWatcher implements IWatcher {
  private active = false;
  private subscription: vscode.Disposable | null = null;
  private readonly config: EventSubscriptionConfig;
  private readonly log;

  constructor(config: EventSubscriptionConfig) {
    this.config = config;
    this.log = createTaggedLogger(config.logTag);
  }

  async start(): Promise<void> {
    if (this.active) {
      return;
    }
    this.subscription = this.config.subscribe();
    this.active = true;
    this.log.debug('Started');
  }

  stop(): void {
    if (!this.active) {
      return;
    }
    this.subscription?.dispose();
    this.subscription = null;
    this.active = false;
    this.log.debug('Stopped');
  }

  isActive(): boolean {
    return this.active;
  }

  isReady(): boolean {
    return this.active;
  }

  async waitForReady(): Promise<void> {
    return Promise.resolve();
  }

  dispose(): void {
    this.stop();
  }
}
