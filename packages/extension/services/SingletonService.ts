// packages/extension/services/SingletonService.ts
// Abstract base class for singleton services with automatic lifecycle management

import * as vscode from 'vscode';
import { debug } from '../logging';
import type { IService } from './types';

// abstract base class for singleton services w/ automatic lifecycle management
export abstract class SingletonService<
  T extends SingletonService<T>,
> implements IService {
  // singleton instance (subclasses MUST override w/ their own static property)
  protected static instance: SingletonService<never> | undefined;

  // disposables managed by this service - cleaned up automatically on dispose
  protected disposables: vscode.Disposable[] = [];

  // unique identifier for debug logging (e.g., 'CONFIG-MANAGER', 'TRUST-MANAGER')
  protected abstract readonly logTag: string;

  // Note: Don't access abstract properties (like logTag) here - they aren't available yet
  protected constructor() {
    // Initialization logging moved to getInstance() since logTag is abstract
  }

  // get singleton instance (creates new instance if none exists)
  // Note: Using Function & { prototype: S } to infer type from prototype without
  // checking constructor accessibility. This allows protected constructors.
  static getInstance<S extends SingletonService<S>>(
    this: Function & { prototype: S }
  ): S {
    // Cast to access protected static 'instance' and call protected constructor
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

    // Clear static instance on the actual class (not base class)
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
    // Default: no-op
  }

  // add a disposable to the managed collection (auto-disposed on service disposal)
  protected addDisposable(disposable: vscode.Disposable): void {
    this.disposables.push(disposable);
  }
}
