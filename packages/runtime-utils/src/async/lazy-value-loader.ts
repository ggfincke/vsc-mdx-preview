// packages/runtime-utils/src/async/lazy-value-loader.ts
// generic lazy loader w/ dedupe, optional retry, & reset safety

// options for configuring lazy loader behavior
export interface LazyValueLoaderOptions<T> {
  // allow retry after a failed load attempt
  allowRetry?: boolean;
  // callback invoked after a successful load
  onLoaded?: (value: T) => void;
  // callback invoked after a failed load
  onFailed?: (error: unknown) => void;
  // callback invoked when loader is reset
  onReset?: () => void;
}

// interface returned by createLazyValueLoader
export interface LazyValueLoader<T> {
  // load & cache value
  load(): Promise<T>;
  // true when value has loaded successfully
  isLoaded(): boolean;
  // true while a load is currently in progress
  isLoading(): boolean;
  // clear cached state & allow a fresh load
  reset(): void;
}

type LoaderStatus = 'idle' | 'loading' | 'loaded' | 'failed';

// create a lazy loader that deduplicates concurrent calls & caches results
export function createLazyValueLoader<T>(
  loadFn: () => Promise<T>,
  options?: LazyValueLoaderOptions<T>
): LazyValueLoader<T> {
  const { allowRetry = false, onLoaded, onFailed, onReset } = options ?? {};

  let status: LoaderStatus = 'idle';
  let cachedValue: T | null = null;
  let hasCachedValue = false;
  let loadingPromise: Promise<T> | null = null;
  let lastError: unknown = null;
  // generation token prevents stale async completions from overwriting fresh state
  let generation = 0;

  function load(): Promise<T> {
    if (status === 'loaded' && hasCachedValue) {
      return Promise.resolve(cachedValue as T);
    }

    if (status === 'loading' && loadingPromise) {
      return loadingPromise;
    }

    if (status === 'failed' && !allowRetry) {
      return Promise.reject(lastError);
    }

    status = 'loading';
    const loadGeneration = generation;

    const promise = loadFn()
      .then((value) => {
        if (generation === loadGeneration) {
          status = 'loaded';
          cachedValue = value;
          hasCachedValue = true;
          loadingPromise = null;
          lastError = null;
          onLoaded?.(value);
        }
        return value;
      })
      .catch((error) => {
        if (generation === loadGeneration) {
          status = 'failed';
          loadingPromise = null;
          lastError = error;
          onFailed?.(error);
        }
        throw error;
      });

    loadingPromise = promise;
    return promise;
  }

  function isLoaded(): boolean {
    return status === 'loaded';
  }

  function isLoading(): boolean {
    return status === 'loading';
  }

  function reset(): void {
    generation++;
    status = 'idle';
    cachedValue = null;
    hasCachedValue = false;
    loadingPromise = null;
    lastError = null;
    onReset?.();
  }

  return {
    load,
    isLoaded,
    isLoading,
    reset,
  };
}
