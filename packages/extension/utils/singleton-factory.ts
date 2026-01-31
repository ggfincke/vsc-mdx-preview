// packages/extension/utils/singleton-factory.ts
// generic singleton factory utility to eliminate duplicated lazy singleton patterns

// singleton configuration options
export interface SingletonOptions<T> {
  // enable reset functionality (useful for testing, no-op when false)
  resettable?: boolean;
  // callback called when instance is disposed or reset (useful for cleanup)
  dispose?: (instance: T) => void;
}

// result of createSingleton w/ get, reset & dispose functions
export interface SingletonResult<T> {
  // get the singleton instance, creating it lazily on first call
  get: () => T;
  // reset the singleton instance (no-op unless resettable: true)
  // calls dispose callback if configured
  reset: () => void;
  // dispose the singleton instance (always clears, calls dispose callback)
  dispose: () => void;
}

// * create a lazy singleton w/ optional reset & disposal support
export function createSingleton<T>(
  factory: () => T,
  options?: SingletonOptions<T>
): SingletonResult<T> {
  let instance: T | null = null;

  const disposeInstance = (): void => {
    if (instance !== null && options?.dispose) {
      options.dispose(instance);
    }
    instance = null;
  };

  return {
    get(): T {
      if (instance === null) {
        instance = factory();
      }
      return instance;
    },
    reset(): void {
      if (options?.resettable) {
        disposeInstance();
      }
    },
    dispose(): void {
      disposeInstance();
    },
  };
}

// create a resettable singleton (shorthand for resettable: true)
export function createResettableSingleton<T>(
  factory: () => T,
  options?: Omit<SingletonOptions<T>, 'resettable'>
): SingletonResult<T> {
  return createSingleton(factory, { ...options, resettable: true });
}
