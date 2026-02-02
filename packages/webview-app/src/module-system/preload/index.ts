// packages/webview-app/src/module-system/preload/index.ts
// preload orchestration for core modules & shim registry

import {
  PRELOADED_MODULE_IDS,
  LogTags,
  type FrameworkId,
} from '@mdx-preview/shared';
import type { ModuleRegistry } from '../registry/ModuleRegistry';
import { preloadCoreModules } from './core';
import { PRELOADED_SHIM_IDS } from './aliases.generated';
import {
  preloadGenericShims,
  GENERIC_SHIM_LOADERS,
  FRAMEWORK_LOADERS,
} from './preload.generated';
import { loadFrameworkCss } from '../../utils/frameworkCssLoader';
import { debug } from '../../utils/debug';
import {
  loadFrameworkShimsWithRetry,
  loadGenericShimsWithRetry,
  type ShimLoadResult,
} from './shimLoader';

export { fallbackLayoutModule } from './core';
export { PRELOAD_ALIASES, PRELOADED_SHIM_IDS } from './aliases.generated';

// track which framework shims have been loaded
let loadedFramework: FrameworkId | null = null;
let frameworkLoadPromise: Promise<void> | null = null;

// track which generic shims have been loaded (for conditional preloading)
let loadedGenericShims = new Set<string>();
let allGenericsLoaded = false;
let genericShimsLoadPromise: Promise<void> | null = null;

// track shim load results for diagnostics
let lastShimLoadResult: ShimLoadResult | null = null;
let lastGenericLoadResult: { loaded: string[]; failed: string[] } | null = null;

// expose shim load results for diagnostics
export function getLastShimLoadResult(): ShimLoadResult | null {
  return lastShimLoadResult;
}

export function getLastGenericLoadResult(): {
  loaded: string[];
  failed: string[];
} | null {
  return lastGenericLoadResult;
}

// initialize preloaded modules in the registry
// load only core modules synchronously - generic & framework shims are lazy-loaded
// generic shims loaded on demand via ensureGenericShims when extension sends component list
// framework-specific shims are loaded lazily via ensureFrameworkShims
export function initPreloadedModules(
  registry: ModuleRegistry,
  vscodeMarkdownLayout: unknown
): void {
  preloadCoreModules(registry, vscodeMarkdownLayout);
  // note: generic shims are now loaded on-demand via ensureGenericShims
  // for conditional preloading optimization
  // load generic CSS (always needed for fallback styling)
  loadFrameworkCss('generic');
  debug(
    `[${LogTags.PRELOAD}] Core modules initialized (generic shims deferred)`
  );
}

// load framework-specific shims on demand
// return immediately if framework already loaded
// use resilient loading w/ retry & fallback to generic shims
export async function ensureFrameworkShims(
  registry: ModuleRegistry,
  framework: FrameworkId
): Promise<void> {
  // already loaded this framework
  if (loadedFramework === framework) {
    debug(`[${LogTags.PRELOAD}] Framework ${framework} shims already loaded`);
    return;
  }

  // wait for in-progress load if same framework
  if (frameworkLoadPromise && loadedFramework === null) {
    debug(`[${LogTags.PRELOAD}] waiting for in-progress framework load`);
    await frameworkLoadPromise;
    if (loadedFramework === framework) {
      return;
    }
  }

  const loader = FRAMEWORK_LOADERS[framework];
  if (!loader) {
    debug(`[${LogTags.PRELOAD}] No loader found for framework: ${framework}`);
    // still load CSS even if no shim loader exists
    await loadFrameworkCss(framework);
    return;
  }

  debug(`[${LogTags.PRELOAD}] Loading ${framework} shims w/ retry...`);

  // load CSS in parallel w/ resilient shim loading
  frameworkLoadPromise = (async () => {
    const [shimResult] = await Promise.all([
      loadFrameworkShimsWithRetry(
        registry,
        framework,
        loader,
        // fallback to generic shims on failure
        preloadGenericShims
      ),
      loadFrameworkCss(framework),
    ]);

    lastShimLoadResult = shimResult;

    if (shimResult.usedFallback) {
      debug(`[${LogTags.PRELOAD}] ${framework} using generic fallback shims`);
    }
  })();

  await frameworkLoadPromise;
  loadedFramework = framework;
  frameworkLoadPromise = null;
  debug(
    `[${LogTags.PRELOAD}] ${framework} shims loaded (success=${lastShimLoadResult?.success})`
  );
}

// load specific generic shims on demand (for conditional preloading)
// handle generic component detection
// use resilient loading w/ retry for individual shims
export async function ensureGenericShims(
  registry: ModuleRegistry,
  componentNames: string[]
): Promise<void> {
  // if all generics already loaded, nothing to do
  if (allGenericsLoaded) {
    debug(`[${LogTags.PRELOAD}] All generic shims already loaded`);
    return;
  }

  // wait for any in-progress load to complete
  if (genericShimsLoadPromise) {
    await genericShimsLoadPromise;
  }

  // filter to only shims that haven't been loaded yet
  const toLoad = componentNames.filter((name) => !loadedGenericShims.has(name));
  if (toLoad.length === 0) {
    debug(`[${LogTags.PRELOAD}] Requested generic shims already loaded`);
    return;
  }

  debug(
    `[${LogTags.PRELOAD}] Loading generic shims w/ retry: ${toLoad.join(', ')}`
  );

  // use resilient loading w/ retry for each shim
  genericShimsLoadPromise = (async () => {
    const result = await loadGenericShimsWithRetry(
      registry,
      toLoad,
      GENERIC_SHIM_LOADERS
    );

    lastGenericLoadResult = result;

    // mark loaded shims
    for (const name of result.loaded) {
      loadedGenericShims.add(name);
    }

    if (result.failed.length > 0) {
      debug(
        `[${LogTags.PRELOAD}] Failed to load generic shims: ${result.failed.join(', ')}`
      );
    }

    debug(
      `[${LogTags.PRELOAD}] Generic shims loaded: ${result.loaded.join(', ')}`
    );
  })();

  await genericShimsLoadPromise;
  genericShimsLoadPromise = null;
}

// get list of all IDs that should be preserved during module reset
export function getPreservedIds(): string[] {
  return [...Object.values(PRELOADED_MODULE_IDS), ...PRELOADED_SHIM_IDS];
}

// reset loaded framework state (for testing)
export function resetFrameworkState(): void {
  loadedFramework = null;
  frameworkLoadPromise = null;
}

// reset loaded generic shims state (for testing)
export function resetGenericShimsState(): void {
  loadedGenericShims = new Set<string>();
  allGenericsLoaded = false;
  genericShimsLoadPromise = null;
}
