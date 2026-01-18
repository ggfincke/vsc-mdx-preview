// packages/extension/utils/SubscriberManager.ts
// Generic subscriber/listener pattern utility to eliminate duplication across services

import * as vscode from 'vscode';
import { debug } from '../logging';

/**
 * Error handler for subscriber notifications.
 * Default logs to debug channel.
 */
export type SubscriberErrorHandler = (error: unknown, subscriberIndex: number) => void;

/**
 * Generic subscriber manager that implements the pub/sub pattern.
 * Eliminates ~200 LOC of duplicated subscriber code across services.
 *
 * @example
 * ```typescript
 * class MyService {
 *   private subscribers = new SubscriberManager<MyData>('MY-SERVICE');
 *
 *   subscribe(callback: (data: MyData) => void): vscode.Disposable {
 *     return this.subscribers.subscribe(callback);
 *   }
 *
 *   private notifyChange(data: MyData): void {
 *     this.subscribers.notify(data);
 *   }
 *
 *   dispose(): void {
 *     this.subscribers.clear();
 *   }
 * }
 * ```
 */
export class SubscriberManager<T> {
  private subscribers = new Set<(data: T) => void>();
  private readonly logTag: string;
  private readonly errorHandler?: SubscriberErrorHandler;

  /**
   * Create a new SubscriberManager.
   * @param logTag Tag for debug logging (e.g., 'CONFIG-MANAGER')
   * @param errorHandler Optional custom error handler. Defaults to debug logging.
   */
  constructor(logTag: string, errorHandler?: SubscriberErrorHandler) {
    this.logTag = logTag;
    this.errorHandler = errorHandler;
  }

  /**
   * Subscribe to notifications.
   * @returns Disposable that removes the subscription when disposed.
   */
  subscribe(callback: (data: T) => void): vscode.Disposable {
    this.subscribers.add(callback);
    return {
      dispose: () => {
        this.subscribers.delete(callback);
      },
    };
  }

  /**
   * Notify all subscribers with the given data.
   * Errors in individual subscribers are caught and logged, not propagated.
   */
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

  /**
   * Clear all subscribers.
   * Should be called in service disposal.
   */
  clear(): void {
    this.subscribers.clear();
  }

  /**
   * Get the number of active subscribers.
   */
  get size(): number {
    return this.subscribers.size;
  }

  /**
   * Check if there are any subscribers.
   */
  get hasSubscribers(): boolean {
    return this.subscribers.size > 0;
  }
}
