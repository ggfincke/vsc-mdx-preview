// packages/webview-client/src/features/module-runtime/preload/index.ts
// preload orchestration for core modules & shim registry

import { type FrameworkId, LogTags } from '@mdx-preview/contracts';
import type { ModuleRegistry } from 'mdx-forge/browser/registry';
import { preloadCoreModules } from './core';
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

// module-level tagged logger (avoids per-call allocation)
const log = createTaggedLogger(LogTags.PRELOAD);

// consolidated preload tracking state
interface PreloadState {
  registryGeneration: number | null;
  requestedFramework: FrameworkId | null;
  // framework shim tracking
  loadedFramework: FrameworkId | null;
  frameworkLoadPromise: Promise<void> | null;
  lastShimLoadResult: ShimLoadResult | null;
  // generic shim tracking
  loadedGenericShims: Set<string>;
  genericShimsLoadPromise: Promise<void> | null;
}

function createInitialState(): PreloadState {
  return {
    registryGeneration: null,
    requestedFramework: null,
    loadedFramework: null,
    frameworkLoadPromise: null,
    lastShimLoadResult: null,
    loadedGenericShims: new Set<string>(),
    genericShimsLoadPromise: null,
  };
}

const state = createInitialState();

function reconcileRegistryGeneration(registry: ModuleRegistry): void {
  if (state.registryGeneration === registry.generation) {
    return;
  }
  state.registryGeneration = registry.generation;
  state.loadedFramework = null;
  state.frameworkLoadPromise = null;
  state.lastShimLoadResult = null;
  state.loadedGenericShims.clear();
  state.genericShimsLoadPromise = null;
}

export function getRequestedFramework(): FrameworkId | null {
  return state.requestedFramework;
}

// initialize preloaded modules in the registry
// load core & generic modules eagerly, then framework shims lazily
export function initPreloadedModules(
  registry: ModuleRegistry,
  vscodeMarkdownLayout: unknown
): void {
  reconcileRegistryGeneration(registry);
  preloadCoreModules(registry, vscodeMarkdownLayout);
  preloadGenericShims(registry);
  for (const componentName of Object.keys(GENERIC_SHIM_LOADERS)) {
    state.loadedGenericShims.add(componentName);
  }

  // generic aliases are required by every Trusted compile output
  // load generic CSS for fallback styling
  loadFrameworkCss('generic');
  log.debug('Core modules initialized (generic shims preloaded)');
}

// load framework-specific shims on demand
// return immediately if framework already loaded
// use resilient loading w/ retry & fallback to generic shims
export async function ensureFrameworkShims(
  registry: ModuleRegistry,
  framework: FrameworkId
): Promise<void> {
  reconcileRegistryGeneration(registry);
  state.requestedFramework = framework;

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

  const registryGeneration = registry.generation;
  // load CSS in parallel w/ resilient shim loading
  const frameworkLoadPromise = (async () => {
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

    if (
      state.registryGeneration !== registryGeneration ||
      registry.generation !== registryGeneration
    ) {
      return;
    }
    state.lastShimLoadResult = shimResult;

    if (shimResult.success && !shimResult.usedFallback) {
      state.loadedFramework = framework;
    }

    if (shimResult.usedFallback) {
      log.debug(`${framework} using generic fallback shims`);
    }
  })();
  state.frameworkLoadPromise = frameworkLoadPromise;

  try {
    await frameworkLoadPromise;
  } finally {
    if (state.frameworkLoadPromise === frameworkLoadPromise) {
      state.frameworkLoadPromise = null;
    }
  }
  log.debug(
    `${framework} shim load completed (success=${state.lastShimLoadResult?.success})`
  );
}

// load specific generic shims on demand (for conditional preloading)
// handle generic component detection
// use resilient loading w/ retry for individual shims
export async function ensureGenericShims(
  registry: ModuleRegistry,
  componentNames: string[]
): Promise<void> {
  reconcileRegistryGeneration(registry);

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

  const registryGeneration = registry.generation;
  // use resilient loading w/ retry for each shim
  const genericShimsLoadPromise = (async () => {
    const result = await loadGenericShimsWithRetry(
      registry,
      toLoad,
      GENERIC_SHIM_LOADERS
    );

    if (
      state.registryGeneration !== registryGeneration ||
      registry.generation !== registryGeneration
    ) {
      return;
    }
    // mark loaded shims
    for (const name of result.loaded) {
      state.loadedGenericShims.add(name);
    }

    if (result.failed.length > 0) {
      log.debug(`Failed to load generic shims: ${result.failed.join(', ')}`);
    }

    log.debug(`Generic shims loaded: ${result.loaded.join(', ')}`);
  })();
  state.genericShimsLoadPromise = genericShimsLoadPromise;

  try {
    await genericShimsLoadPromise;
  } finally {
    if (state.genericShimsLoadPromise === genericShimsLoadPromise) {
      state.genericShimsLoadPromise = null;
    }
  }
}
