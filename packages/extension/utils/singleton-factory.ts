// packages/extension/utils/singleton-factory.ts
// Generic singleton factory utility to eliminate duplicated lazy singleton patterns

// singleton configuration options
export interface SingletonOptions {
  // enable reset functionality (useful for testing, no-op when false)
  resettable?: boolean;
}

// result of createSingleton w/ get & reset functions
export interface SingletonResult<T> {
  // get the singleton instance, creating it lazily on first call
  get: () => T;
  // reset the singleton instance (no-op unless resettable: true)
  reset: () => void;
}

// * create a lazy singleton w/ optional reset support
export function createSingleton<T>(
  factory: () => T,
  options?: SingletonOptions
): SingletonResult<T> {
  let instance: T | null = null;

  return {
    get(): T {
      if (instance === null) {
        instance = factory();
      }
      return instance;
    },
    reset(): void {
      if (options?.resettable) {
        instance = null;
      }
    },
  };
}

// create a resettable singleton (shorthand for resettable: true)
export function createResettableSingleton<T>(factory: () => T): SingletonResult<T> {
  return createSingleton(factory, { resettable: true });
}
