// packages/extension/utils/lazy-import.ts
// utility for lazy-loading modules w/ caching & race condition handling

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
