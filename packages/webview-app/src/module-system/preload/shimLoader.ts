// packages/webview-app/src/module-system/preload/shimLoader.ts
// resilient shim loading w/ retry & fallback to generic shims (O.3)

import { debug } from '../../utils/debug';
import { normalizeError, extractErrorMessage, LogTags } from '@mdx-preview/shared';
import {
  SHIM_LOAD_MAX_RETRIES,
  SHIM_LOAD_RETRY_DELAY_MS,
} from '../../constants';
import type { ModuleRegistry } from '../registry/ModuleRegistry';
import type { Framework } from '@mdx-preview/shared';

// result of shim loading attempt
export interface ShimLoadResult {
  success: boolean;
  framework: Framework;
  failedShims: string[];
  usedFallback: boolean;
}

// result of retry operation
interface RetryResult<T> {
  result: T | null;
  attempts: number;
  lastError?: Error;
}

// utility: delay with exponential backoff
function delay(attempt: number): Promise<void> {
  const ms = SHIM_LOAD_RETRY_DELAY_MS * Math.pow(2, attempt);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// retry a loader function with exponential backoff
async function retryLoad<T>(
  name: string,
  loader: () => Promise<T>,
  maxRetries: number = SHIM_LOAD_MAX_RETRIES
): Promise<RetryResult<T>> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await loader();
      if (attempt > 0) {
        debug(`[${LogTags.SHIM_LOADER}] ${name} succeeded on attempt ${attempt + 1}`);
      }
      return { result, attempts: attempt + 1 };
    } catch (error) {
      lastError = normalizeError(error);
      debug(
        `[${LogTags.SHIM_LOADER}] ${name} failed (attempt ${attempt + 1}/${maxRetries + 1}): ${lastError.message}`
      );

      if (attempt < maxRetries) {
        await delay(attempt);
      }
    }
  }

  return { result: null, attempts: maxRetries + 1, lastError };
}

// load framework shims with retry and fallback to generic
export async function loadFrameworkShimsWithRetry(
  registry: ModuleRegistry,
  framework: Framework,
  frameworkLoader: (registry: ModuleRegistry) => Promise<void>,
  genericFallbackLoader: (registry: ModuleRegistry) => void
): Promise<ShimLoadResult> {
  const result: ShimLoadResult = {
    success: false,
    framework,
    failedShims: [],
    usedFallback: false,
  };

  // skip for generic framework (no special shims needed)
  if (framework === 'generic') {
    result.success = true;
    return result;
  }

  // attempt to load framework-specific shims with retry
  const loadResult = await retryLoad(
    `${framework} shims`,
    () => frameworkLoader(registry)
  );

  if (loadResult.result !== null) {
    result.success = true;
    debug(`[${LogTags.SHIM_LOADER}] ${framework} shims loaded successfully`);
    return result;
  }

  // framework shims failed - fall back to generic shims
  debug(
    `[${LogTags.SHIM_LOADER}] ${framework} shims failed after ${loadResult.attempts} attempts, using generic fallback`
  );

  try {
    genericFallbackLoader(registry);
    result.usedFallback = true;
    result.success = true;
    debug(`[${LogTags.SHIM_LOADER}] Generic fallback loaded for ${framework}`);
  } catch (fallbackError) {
    const errorMessage = extractErrorMessage(fallbackError);
    debug(`[${LogTags.SHIM_LOADER}] Generic fallback also failed: ${errorMessage}`);
    result.failedShims.push('generic-fallback');
  }

  return result;
}

// load individual generic shims with retry
export async function loadGenericShimsWithRetry(
  registry: ModuleRegistry,
  componentNames: string[],
  shimLoaders: Record<string, (registry: ModuleRegistry) => Promise<void>>
): Promise<{ loaded: string[]; failed: string[] }> {
  const loaded: string[] = [];
  const failed: string[] = [];

  // load shims in parallel with individual retry
  const loadPromises = componentNames.map(async (name) => {
    const loader = shimLoaders[name];
    if (!loader) {
      debug(`[${LogTags.SHIM_LOADER}] No loader for generic shim: ${name}`);
      return;
    }

    const result = await retryLoad(name, () => loader(registry));
    if (result.result !== null) {
      loaded.push(name);
    } else {
      failed.push(name);
      debug(
        `[${LogTags.SHIM_LOADER}] Generic shim ${name} failed permanently: ${result.lastError?.message}`
      );
    }
  });

  await Promise.all(loadPromises);

  return { loaded, failed };
}

// for testing: expose retry function
export { retryLoad as _retryLoadForTesting };
