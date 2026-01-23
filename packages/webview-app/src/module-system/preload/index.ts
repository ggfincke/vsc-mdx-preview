// packages/webview-app/src/module-system/preload/index.ts
// preload orchestration for core modules & shim registry

import { PRELOADED_MODULE_IDS, type Framework } from '@mdx-preview/shared';
import type { ModuleRegistry } from '../registry/ModuleRegistry';
import { preloadCoreModules } from './core';
import { PRELOADED_SHIM_IDS } from './aliases.generated';
import {
  preloadGenericShims,
  GENERIC_SHIM_LOADERS,
  FRAMEWORK_LOADERS,
  preloadAllShims,
} from './preload.generated';
import { loadFrameworkCss } from '../../utils/frameworkCssLoader';
import { debug } from '../../utils/debug';

export { fallbackLayoutModule } from './core';
export { PRELOAD_ALIASES, PRELOADED_SHIM_IDS } from './aliases.generated';

// track which framework shims have been loaded
let loadedFramework: Framework | null = null;
let frameworkLoadPromise: Promise<void> | null = null;

// track which generic shims have been loaded (for conditional preloading)
let loadedGenericShims = new Set<string>();
let allGenericsLoaded = false;
let genericShimsLoadPromise: Promise<void> | null = null;

// initialize preloaded modules in the registry
// loads only core modules synchronously - generic and framework shims are lazy-loaded
// generic shims loaded on demand via ensureGenericShims when extension sends component list
// framework-specific shims are loaded lazily via ensureFrameworkShims
export function initPreloadedModules(
  registry: ModuleRegistry,
  vscodeMarkdownLayout: unknown
): void {
  preloadCoreModules(registry, vscodeMarkdownLayout);
  // Note: generic shims are now loaded on-demand via ensureGenericShims
  // for conditional preloading optimization
  // Load generic CSS (always needed for fallback styling)
  loadFrameworkCss('generic');
  debug('[PRELOAD] Core modules initialized (generic shims deferred)');
}

// load framework-specific shims on demand
// returns immediately if the framework is already loaded
export async function ensureFrameworkShims(
  registry: ModuleRegistry,
  framework: Framework
): Promise<void> {
  // already loaded this framework
  if (loadedFramework === framework) {
    debug(`[PRELOAD] Framework ${framework} shims already loaded`);
    return;
  }

  // wait for in-progress load if same framework
  if (frameworkLoadPromise && loadedFramework === null) {
    debug(`[PRELOAD] Waiting for in-progress framework load`);
    await frameworkLoadPromise;
    if (loadedFramework === framework) {
      return;
    }
  }

  const loader = FRAMEWORK_LOADERS[framework];
  if (!loader) {
    debug(`[PRELOAD] No loader found for framework: ${framework}`);
    // Still load CSS even if no shim loader exists
    await loadFrameworkCss(framework);
    return;
  }

  debug(`[PRELOAD] Loading ${framework} shims and CSS...`);
  // Load CSS in parallel with shim components for faster loading
  frameworkLoadPromise = Promise.all([
    loader(registry),
    loadFrameworkCss(framework),
  ]).then(() => {});
  await frameworkLoadPromise;
  loadedFramework = framework;
  frameworkLoadPromise = null;
  debug(`[PRELOAD] ${framework} shims and CSS loaded successfully`);
}

// load specific generic shims on demand (for conditional preloading)
// called when extension detects which generic components are used in the MDX
export async function ensureGenericShims(
  registry: ModuleRegistry,
  componentNames: string[]
): Promise<void> {
  // if all generics already loaded, nothing to do
  if (allGenericsLoaded) {
    debug('[PRELOAD] All generic shims already loaded');
    return;
  }

  // wait for any in-progress load to complete
  if (genericShimsLoadPromise) {
    await genericShimsLoadPromise;
  }

  // filter to only shims that haven't been loaded yet
  const toLoad = componentNames.filter(name => !loadedGenericShims.has(name));
  if (toLoad.length === 0) {
    debug('[PRELOAD] Requested generic shims already loaded');
    return;
  }

  debug(`[PRELOAD] Loading generic shims: ${toLoad.join(', ')}`);

  // get loaders for the requested shims (filter out any that don't exist)
  const loaders = toLoad
    .map(name => ({ name, loader: GENERIC_SHIM_LOADERS[name] }))
    .filter((item): item is { name: string; loader: (registry: ModuleRegistry) => Promise<void> } =>
      item.loader !== undefined
    );

  if (loaders.length === 0) {
    debug('[PRELOAD] No loaders found for requested generic shims');
    return;
  }

  // load all requested shims in parallel
  genericShimsLoadPromise = Promise.all(
    loaders.map(({ loader }) => loader(registry))
  ).then(() => {});

  await genericShimsLoadPromise;
  genericShimsLoadPromise = null;

  // mark these shims as loaded
  for (const { name } of loaders) {
    loadedGenericShims.add(name);
  }

  debug(`[PRELOAD] Generic shims loaded: ${loaders.map(l => l.name).join(', ')}`);
}

// load all generic shims (fallback when conditional loading fails or for backward compat)
export async function loadAllGenericShims(registry: ModuleRegistry): Promise<void> {
  if (allGenericsLoaded) {
    return;
  }

  debug('[PRELOAD] Loading all generic shims (fallback)');
  preloadGenericShims(registry);
  allGenericsLoaded = true;
}

// get list of all IDs that should be preserved during module reset
export function getPreservedIds(): string[] {
  return [...Object.values(PRELOADED_MODULE_IDS), ...PRELOADED_SHIM_IDS];
}

// for backward compatibility: load all shims (used by preloadAllShims)
export async function loadAllFrameworkShims(
  registry: ModuleRegistry
): Promise<void> {
  await preloadAllShims(registry);
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
