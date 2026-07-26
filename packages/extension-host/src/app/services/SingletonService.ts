// packages/extension-host/src/app/services/SingletonService.ts
// abstract base class for singleton services w/ automatic lifecycle management

import * as vscode from 'vscode';
import { createTaggedLogger } from '../../shared/logging/logger';
import { disposeCollection } from '../../shared/utils/disposable';
import type { IService } from './types';
import type { LogTag, TaggedLogger } from '@mdx-preview/contracts';

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

  // lazy-initialized tagged logger (uses subclass logTag)
  private _log?: TaggedLogger;
  protected get log(): TaggedLogger {
    return (this._log ??= createTaggedLogger(this.logTag));
  }

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
      ctor.instance.log.debug('Initialized');
    }
    return ctor.instance;
  }

  // dispose all managed resources & clear singleton instance
  dispose(): void {
    this.onDispose();

    disposeCollection(this.disposables);

    // clear static instance on the actual class (not base class)
    const ctor = this.constructor as typeof SingletonService;
    ctor.instance = undefined;

    this.log.debug('Disposed');
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

// abstract singleton base that adds subscribe/notify helpers for service events
export abstract class WithSubscribers<
  T extends SingletonService<T>,
  EventData,
> extends SingletonService<T> {
  private readonly subscribers = new Set<(data: EventData) => void>();
  private readonly errorHandler?: SubscriberErrorHandler;

  protected constructor(errorHandler?: SubscriberErrorHandler) {
    super();
    this.errorHandler = errorHandler;

    // clear subscribers during disposal even if subclass overrides onDispose
    this.addDisposable({
      dispose: () => {
        this.subscribers.clear();
      },
    });
  }

  // subscribe to service events (returns disposable to unsubscribe)
  subscribe(callback: (data: EventData) => void): vscode.Disposable {
    this.subscribers.add(callback);
    return {
      dispose: () => {
        this.subscribers.delete(callback);
      },
    };
  }

  // notify current subscribers (errors caught & logged)
  protected notifySubscribers(data: EventData): void {
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
}
