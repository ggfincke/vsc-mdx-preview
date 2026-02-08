// packages/webview-app/src/utils/createResourceLoader.ts
// factory for creating idempotent async resource loaders w/ state machine
//
// implements the loader state machine pattern
// - null: not started
// - Promise<void>: loading in progress (deduplicates concurrent calls)
// - true: loaded successfully
// - false: failed (allow retry if allowRetry is true)

import { LogTags } from '@mdx-preview/shared';
import { createTaggedLogger } from './createTaggedLogger';

const log = createTaggedLogger(LogTags.RESOURCE_LOADER);

// options for creating a resource loader
export interface ResourceLoaderOptions {
  // debug name
  name: string;
  // retry enabled
  allowRetry?: boolean;
}

// interface returned by createResourceLoader
export interface ResourceLoader {
  // load resource
  load(): Promise<void>;
  // loaded check
  isLoaded(): boolean;
  // loading check
  isLoading(): boolean;
  // reset state
  reset(): void;
}

// state type: null | Promise | true | false
type LoaderState = null | Promise<void> | boolean;

// create an idempotent resource loader w/ state machine
// example
//   const katexLoader = createResourceLoader(
//     async () => { await import('katex/dist/katex.min.css'); },
//     { name: 'KaTeX CSS' }
//   );
//   // multiple calls deduplicate
//   await Promise.all([katexLoader.load(), katexLoader.load()]);
//   // already loaded, return immediately
//   await katexLoader.load();
export function createResourceLoader(
  loadFn: () => Promise<void>,
  options: ResourceLoaderOptions
): ResourceLoader {
  const { name, allowRetry = true } = options;

  let state: LoaderState = null;

  function load(): Promise<void> {
    // already loaded successfully
    if (state === true) {
      return Promise.resolve();
    }

    // loading in progress - return existing promise to deduplicate concurrent calls
    if (state instanceof Promise) {
      return state;
    }

    // failed previously & retry not allowed
    if (state === false && !allowRetry) {
      return Promise.reject(
        new Error(`[${name}] Loading failed & retry is disabled`)
      );
    }

    // not started (null) or failed previously (false w/ allowRetry) - start loading
    const loadPromise = loadFn()
      .then(() => {
        state = true;
      })
      .catch((error) => {
        log.error(`${name}: Failed to load:`, error);
        // allow retry on next call (if allowRetry is true, state becomes false)
        // if allowRetry is false, state also becomes false but load() will reject
        state = false;
        // re-throw for callers who await
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
