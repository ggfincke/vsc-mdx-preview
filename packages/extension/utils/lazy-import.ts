// packages/extension/utils/lazy-import.ts
// utility for lazy-loading modules with caching and race condition handling

/**
 * Creates a lazy import function that caches the module after first load.
 * Handles concurrent calls correctly by sharing the loading promise.
 *
 * @param importFn - Function that returns a promise resolving to the module
 * @returns A function that returns the cached module or loads it on first call
 *
 * @example
 * ```typescript
 * const getCompilerModule = createLazyImport(
 *   () => import('../compiler/safe/compile')
 * );
 *
 * // First call loads the module
 * const { compileSafe } = await getCompilerModule();
 *
 * // Subsequent calls return cached module
 * const { compileSafe: same } = await getCompilerModule();
 * ```
 */
export function createLazyImport<T>(importFn: () => Promise<T>): () => Promise<T> {
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

    // start loading and cache the promise
    loading = importFn().then((mod) => {
      cached = mod;
      loading = null;
      return mod;
    });

    return loading;
  };
}
