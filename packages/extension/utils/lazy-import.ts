// packages/extension/utils/lazy-import.ts
// utility for lazy-loading modules w/ caching & race condition handling

import { pathToFileURL } from 'url';

// create lazy import function that caches the module after first load
// handle concurrent calls by sharing loading promise
export function createLazyImport<T>(
  importFn: () => Promise<T>
): () => Promise<T> {
  let cached: T | null = null;
  let loading: Promise<T> | null = null;

  return async () => {
    // return cached module if already loaded
    if (cached) {
      return cached;
    }

    // return existing promise if currently loading (prevents duplicate imports)
    if (loading) {
      return loading;
    }

    // start loading & cache the promise
    loading = importFn().then((mod) => {
      cached = mod;
      loading = null;
      return mod;
    });

    return loading;
  };
}

// options for keyed lazy import
export interface KeyedLazyImportOptions<T> {
  // load module by key
  loadFn: (key: string) => Promise<T | null>;
  // validation function
  validate?: (mod: T) => boolean;
  // validation failed callback
  onValidationFailed?: (key: string, mod: T) => void;
  // load success callback
  onLoaded?: (key: string, mod: T) => void;
  // load error callback
  onLoadFailed?: (key: string, error: unknown) => void;
}

// create keyed lazy import for modules that vary by key (e.g., workspace root)
// handle caching per key & race condition prevention
export function createKeyedLazyImport<T>(options: KeyedLazyImportOptions<T>): {
  get: (key: string) => Promise<T | null>;
  clear: () => void;
  clearKey: (key: string) => void;
} {
  const { loadFn, validate, onValidationFailed, onLoaded, onLoadFailed } =
    options;
  const cache = new Map<string, T | null>();
  const loading = new Map<string, Promise<T | null>>();

  return {
    async get(key: string): Promise<T | null> {
      // return cached value if present (including null for "not found")
      if (cache.has(key)) {
        return cache.get(key)!;
      }

      // return existing promise if currently loading
      const existing = loading.get(key);
      if (existing) {
        return existing;
      }

      // start loading
      const promise = loadFn(key)
        .then((mod) => {
          // validate if provided
          if (mod !== null && validate && !validate(mod)) {
            onValidationFailed?.(key, mod);
            cache.set(key, null);
            return null;
          }

          if (mod !== null) {
            onLoaded?.(key, mod);
          }

          cache.set(key, mod);
          return mod;
        })
        .catch((error) => {
          onLoadFailed?.(key, error);
          cache.set(key, null);
          return null;
        })
        .finally(() => {
          loading.delete(key);
        });

      loading.set(key, promise);
      return promise;
    },

    clear(): void {
      cache.clear();
      loading.clear();
    },

    clearKey(key: string): void {
      cache.delete(key);
      loading.delete(key);
    },
  };
}

// load a module from path, trying CommonJS first then ESM fallback
// return default export or module
export async function loadModuleWithEsmFallback<T>(
  modulePath: string
): Promise<T> {
  try {
    // try CommonJS require first (most common case)

    const mod = require(modulePath);
    return (mod.default ?? mod) as T;
  } catch (error: unknown) {
    // check if it's an ESM-only module
    const isEsm =
      error instanceof Error &&
      'code' in error &&
      (error as NodeJS.ErrnoException).code === 'ERR_REQUIRE_ESM';

    if (isEsm) {
      // try ESM import
      const specifier = pathToFileURL(modulePath).href;
      const mod = await import(specifier);
      return ((mod as { default?: unknown }).default ?? mod) as T;
    }

    // re-throw original error if not ESM related
    throw error;
  }
}
