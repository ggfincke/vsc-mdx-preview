// packages/webview-client/src/shared/utils/createResourceLoader.ts
// factory for creating idempotent async resource loaders w/ state machine

import { LogTags } from '@mdx-preview/contracts';
import { createLazyValueLoader } from '@mdx-preview/runtime-utils';
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

// create an idempotent resource loader w/ state machine
export function createResourceLoader(
  loadFn: () => Promise<void>,
  options: ResourceLoaderOptions
): ResourceLoader {
  const { name, allowRetry = true } = options;
  let failed = false;

  const loader = createLazyValueLoader(loadFn, {
    allowRetry,
    onLoaded: () => {
      failed = false;
    },
    onFailed: (error) => {
      failed = true;
      log.error(`${name}: Failed to load:`, error);
    },
    onReset: () => {
      failed = false;
    },
  });

  function load(): Promise<void> {
    // preserve existing createResourceLoader semantics: after a failed load w/
    // retries disabled, subsequent calls reject immediately w/ a descriptive error
    if (failed && !allowRetry) {
      return Promise.reject(
        new Error(`[${name}] Loading failed & retry is disabled`)
      );
    }
    return loader.load();
  }

  return {
    load,
    isLoaded: loader.isLoaded,
    isLoading: loader.isLoading,
    reset: loader.reset,
  };
}
