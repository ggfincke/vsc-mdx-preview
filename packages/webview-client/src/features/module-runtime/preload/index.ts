// packages/webview-client/src/features/module-runtime/preload/index.ts
// preload orchestration for core modules & shim registry

import {
  type FrameworkId,
  LogTags,
  PRELOADED_MODULE_IDS,
} from '@mdx-preview/contracts';
import type { ModuleRegistry } from 'mdx-forge/browser/registry';
import { preloadCoreModules } from './core';
import { PRELOADED_SHIM_IDS } from '../../../generated/preload/aliases.generated';
import {
  preloadGenericShims,
  GENERIC_SHIM_LOADERS,
  FRAMEWORK_LOADERS,
} from '../../../generated/preload/preload.generated';
import { loadFrameworkCss } from '../../../generated/framework-css/frameworkCssLoader';
import { createTaggedLogger } from '../../../shared/utils/createTaggedLogger';
import {
  loadFrameworkShimsWithRetry,
  loadGenericShimsWithRetry,
  type ShimLoadResult,
} from './shimLoader';

export { fallbackLayoutModule } from './core';
export { PRELOADED_SHIM_IDS } from '../../../generated/preload/aliases.generated';

// module-level tagged logger (avoids per-call allocation)
const log = createTaggedLogger(LogTags.PRELOAD);

// consolidated preload tracking state
interface PreloadState {
  // framework shim tracking
  loadedFramework: FrameworkId | null;
  frameworkLoadPromise: Promise<void> | null;
  lastShimLoadResult: ShimLoadResult | null;
  // generic shim tracking
  loadedGenericShims: Set<string>;
  genericShimsLoadPromise: Promise<void> | null;
  lastGenericLoadResult: { loaded: string[]; failed: string[] } | null;
}

function createInitialState(): PreloadState {
  return {
    loadedFramework: null,
    frameworkLoadPromise: null,
    lastShimLoadResult: null,
    loadedGenericShims: new Set<string>(),
    genericShimsLoadPromise: null,
    lastGenericLoadResult: null,
  };
}

const state = createInitialState();

// initialize preloaded modules in the registry
// load core modules eagerly, then generic & framework shims lazily
export function initPreloadedModules(
  registry: ModuleRegistry,
  vscodeMarkdownLayout: unknown
): void {
  preloadCoreModules(registry, vscodeMarkdownLayout);
  // note: generic shims are now loaded on-demand via ensureGenericShims
  // for conditional preloading optimization
  // load generic CSS (always needed for fallback styling)
  loadFrameworkCss('generic');
  log.debug('Core modules initialized (generic shims deferred)');
}

// load framework-specific shims on demand
// return immediately if framework already loaded
// use resilient loading w/ retry & fallback to generic shims
export async function ensureFrameworkShims(
  registry: ModuleRegistry,
  framework: FrameworkId
): Promise<void> {
  // already loaded this framework
  if (state.loadedFramework === framework) {
    log.debug(`Framework ${framework} shims already loaded`);
    return;
  }

  // wait for in-progress load if same framework
  if (state.frameworkLoadPromise && state.loadedFramework === null) {
    log.debug('waiting for in-progress framework load');
    await state.frameworkLoadPromise;
    if (state.loadedFramework === framework) {
      return;
    }
  }

  const loader = FRAMEWORK_LOADERS[framework];
  if (!loader) {
    log.debug(`No loader found for framework: ${framework}`);
    // still load CSS even if no shim loader exists
    await loadFrameworkCss(framework);
    return;
  }

  log.debug(`Loading ${framework} shims w/ retry...`);

  // load CSS in parallel w/ resilient shim loading
  state.frameworkLoadPromise = (async () => {
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

    state.lastShimLoadResult = shimResult;

    if (shimResult.success) {
      state.loadedFramework = framework;
    }

    if (shimResult.usedFallback) {
      log.debug(`${framework} using generic fallback shims`);
    }
  })();

  try {
    await state.frameworkLoadPromise;
  } finally {
    state.frameworkLoadPromise = null;
  }
  log.debug(
    `${framework} shims loaded (success=${state.lastShimLoadResult?.success})`
  );
}

// load specific generic shims on demand (for conditional preloading)
// handle generic component detection
// use resilient loading w/ retry for individual shims
export async function ensureGenericShims(
  registry: ModuleRegistry,
  componentNames: string[]
): Promise<void> {
  // wait for any in-progress load to complete
  if (state.genericShimsLoadPromise) {
    await state.genericShimsLoadPromise;
  }

  // filter to only shims that haven't been loaded yet
  const toLoad = componentNames.filter(
    (name) => !state.loadedGenericShims.has(name)
  );
  if (toLoad.length === 0) {
    log.debug('Requested generic shims already loaded');
    return;
  }

  log.debug(`Loading generic shims w/ retry: ${toLoad.join(', ')}`);

  // use resilient loading w/ retry for each shim
  state.genericShimsLoadPromise = (async () => {
    const result = await loadGenericShimsWithRetry(
      registry,
      toLoad,
      GENERIC_SHIM_LOADERS
    );

    state.lastGenericLoadResult = result;

    // mark loaded shims
    for (const name of result.loaded) {
      state.loadedGenericShims.add(name);
    }

    if (result.failed.length > 0) {
      log.debug(`Failed to load generic shims: ${result.failed.join(', ')}`);
    }

    log.debug(`Generic shims loaded: ${result.loaded.join(', ')}`);
  })();

  try {
    await state.genericShimsLoadPromise;
  } finally {
    state.genericShimsLoadPromise = null;
  }
}

// get list of all IDs that should be preserved during module reset
export function getPreservedIds(): string[] {
  return [...Object.values(PRELOADED_MODULE_IDS), ...PRELOADED_SHIM_IDS];
}
