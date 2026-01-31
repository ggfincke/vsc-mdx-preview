// packages/webview-app/src/utils/createResourceLoader.ts
// factory for creating idempotent async resource loaders w/ state machine
//
// Implements the loader state machine pattern:
// - null: not started
// - Promise<void>: loading in progress (deduplicates concurrent calls)
// - true: loaded successfully
// - false: failed (allows retry if allowRetry is true)

// options for creating a resource loader
export interface ResourceLoaderOptions {
  // name for debug logging
  name: string;
  // allow retry on failure (default: true)
  allowRetry?: boolean;
}

// interface returned by createResourceLoader
export interface ResourceLoader {
  // load the resource (idempotent)
  load(): Promise<void>;
  // check if resource is loaded successfully
  isLoaded(): boolean;
  // check if resource is currently loading
  isLoading(): boolean;
  // reset state (for testing)
  reset(): void;
}

// State type: null | Promise | true | false
type LoaderState = null | Promise<void> | boolean;

// create an idempotent resource loader w/ state machine
// example:
// ```typescript
// const katexLoader = createResourceLoader(
//   async () => { await import('katex/dist/katex.min.css'); },
//   { name: 'KaTeX CSS' }
// );
//
// // Multiple calls deduplicate
// await Promise.all([katexLoader.load(), katexLoader.load()]);
//
// // Already loaded, returns immediately
// await katexLoader.load();
// ```
export function createResourceLoader(
  loadFn: () => Promise<void>,
  options: ResourceLoaderOptions
): ResourceLoader {
  const { name, allowRetry = true } = options;

  let state: LoaderState = null;

  function load(): Promise<void> {
    // Already loaded successfully
    if (state === true) {
      return Promise.resolve();
    }

    // Loading in progress - return existing promise (deduplicates concurrent calls)
    if (state instanceof Promise) {
      return state;
    }

    // Failed previously & retry not allowed
    if (state === false && !allowRetry) {
      return Promise.reject(
        new Error(`[${name}] Loading failed & retry is disabled`)
      );
    }

    // Not started (null) or failed previously (false w/ allowRetry) - start loading
    const loadPromise = loadFn()
      .then(() => {
        state = true;
      })
      .catch((error) => {
        console.error(`${name}: Failed to load:`, error);
        // Allow retry on next call (if allowRetry is true, state becomes false)
        // If allowRetry is false, state also becomes false but load() will reject
        state = false;
        // Re-throw for callers who await
        throw error;
      });

    state = loadPromise;
    return loadPromise;
  }

  function isLoaded(): boolean {
    return state === true;
  }

  function isLoading(): boolean {
    return state instanceof Promise;
  }

  function reset(): void {
    state = null;
  }

  return {
    load,
    isLoaded,
    isLoading,
    reset,
  };
}
