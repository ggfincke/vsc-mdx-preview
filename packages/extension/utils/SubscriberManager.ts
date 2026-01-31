// packages/extension/utils/SubscriberManager.ts
// generic subscriber/listener pattern utility to eliminate duplication across services

import * as vscode from 'vscode';
import { debug } from '../logging';
import type { LogTag } from '@mdx-preview/shared';

// error handler for subscriber notifications (default logs to debug channel)
export type SubscriberErrorHandler = (
  error: unknown,
  subscriberIndex: number
) => void;

// interface for services that support subscription to state changes
export interface ISubscribable<T> {
  // subscribe to state change notifications
  subscribe(callback: (data: T) => void): vscode.Disposable;
}

// generic subscriber manager that implements the pub/sub pattern
export class SubscriberManager<T> {
  private subscribers = new Set<(data: T) => void>();
  private readonly logTag: LogTag;
  private readonly errorHandler?: SubscriberErrorHandler;

  // create a new SubscriberManager w/ log tag & optional error handler
  constructor(logTag: LogTag, errorHandler?: SubscriberErrorHandler) {
    this.logTag = logTag;
    this.errorHandler = errorHandler;
  }

  // subscribe to notifications (returns disposable to unsubscribe)
  subscribe(callback: (data: T) => void): vscode.Disposable {
    this.subscribers.add(callback);
    return {
      dispose: () => {
        this.subscribers.delete(callback);
      },
    };
  }

  // notify all subscribers w/ the given data (errors caught & logged)
  notify(data: T): void {
    let index = 0;
    for (const callback of this.subscribers) {
      try {
        callback(data);
      } catch (error) {
        if (this.errorHandler) {
          this.errorHandler(error, index);
        } else {
          debug(`[${this.logTag}] Error in subscriber ${index}: ${error}`);
        }
      }
      index++;
    }
  }

  // clear all subscribers (call in service disposal)
  clear(): void {
    this.subscribers.clear();
  }

  // get the number of active subscribers
  get size(): number {
    return this.subscribers.size;
  }

  // check if there are any subscribers
  get hasSubscribers(): boolean {
    return this.subscribers.size > 0;
  }
}
