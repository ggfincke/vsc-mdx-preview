// packages/extension/services/SingletonService.ts
// abstract base class for singleton services w/ automatic lifecycle management

import * as vscode from 'vscode';
import { createTaggedLogger, debug } from '../logging';
import type { IService } from '../types';
import type { LogTag, TaggedLogger } from '@mdx-preview/shared';

// abstract base class for singleton services w/ automatic lifecycle management
export abstract class SingletonService<
  T extends SingletonService<T>,
> implements IService {
  // singleton instance (subclasses MUST override w/ their own static property)
  protected static instance: SingletonService<never> | undefined;

  // disposables managed by this service - cleaned up automatically on dispose
  protected disposables: vscode.Disposable[] = [];

  // use log tag for debug logging (e.g., LogTags.CONFIG_MANAGER)
  protected abstract readonly logTag: LogTag;

  // note: don't access abstract properties (like logTag) here - they aren't available yet
  protected constructor() {
    // initialization logging moved to getInstance() since logTag is abstract
  }

  // get singleton instance (creates new instance if none exists)
  // note: using a permissive `this` type that only requires prototype,
  // allowing classes w/ protected constructors & protected instance to use getInstance()
  static getInstance<S extends SingletonService<S>>(this: { prototype: S }): S {
    // cast to access protected static 'instance' & call protected constructor
    const ctor = this as unknown as { instance?: S; new (): S };
    if (!ctor.instance) {
      ctor.instance = new ctor();
      debug(`[${ctor.instance.logTag}] Initialized`);
    }
    return ctor.instance;
  }

  // dispose all managed resources & clear singleton instance
  dispose(): void {
    this.onDispose();

    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];

    // clear static instance on the actual class (not base class)
    const ctor = this.constructor as typeof SingletonService;
    ctor.instance = undefined;

    debug(`[${this.logTag}] Disposed`);
  }

  // static dispose for direct singleton cleanup without instance reference
  static dispose(): void {
    if (this.instance) {
      this.instance.dispose();
      // instance is cleared by instance.dispose()
    }
  }

  // reset singleton instance for testing
  static reset(): void {
    this.dispose();
  }

  // override this for custom cleanup logic (called before disposables are disposed)
  protected onDispose(): void {
    // default: no-op
  }

  // add a disposable to the managed collection (auto-disposed on service disposal)
  protected addDisposable(disposable: vscode.Disposable): void {
    this.disposables.push(disposable);
  }
}

// error handler for subscriber notifications (default logs to debug channel)
type SubscriberErrorHandler = (error: unknown, subscriberIndex: number) => void;

// interface for services that support subscription to state changes
export interface ISubscribable<T> {
  // subscribe to state change notifications
  subscribe(callback: (data: T) => void): vscode.Disposable;
}

// pub/sub manager for service events (internal to WithSubscribers)
class SubscriberManager<T> {
  private subscribers = new Set<(data: T) => void>();
  private readonly log: TaggedLogger;
  private readonly errorHandler?: SubscriberErrorHandler;

  constructor(logTag: LogTag, errorHandler?: SubscriberErrorHandler) {
    this.log = createTaggedLogger(logTag);
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
      } catch (error: unknown) {
        if (this.errorHandler) {
          this.errorHandler(error, index);
        } else {
          this.log.debug(`Error in subscriber ${index}: ${error}`);
        }
      }
      index++;
    }
  }

  // clear all subscribers (call in service disposal)
  clear(): void {
    this.subscribers.clear();
  }
}

// abstract singleton base that adds subscribe/notify helpers for service events
export abstract class WithSubscribers<T extends SingletonService<T>, EventData>
  extends SingletonService<T>
  implements ISubscribable<EventData>
{
  private readonly subscriberManager: SubscriberManager<EventData>;

  protected constructor(
    subscriberLogTag: LogTag,
    errorHandler?: SubscriberErrorHandler
  ) {
    super();
    this.subscriberManager = new SubscriberManager<EventData>(
      subscriberLogTag,
      errorHandler
    );

    // clear subscribers during disposal even if subclass overrides onDispose
    this.addDisposable({
      dispose: () => {
        this.subscriberManager.clear();
      },
    });
  }

  // subscribe to service events
  subscribe(callback: (data: EventData) => void): vscode.Disposable {
    return this.subscriberManager.subscribe(callback);
  }

  // notify current subscribers
  protected notifySubscribers(data: EventData): void {
    this.subscriberManager.notify(data);
  }
}
