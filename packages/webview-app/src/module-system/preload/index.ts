// packages/webview-app/src/module-system/preload/index.ts
// preload orchestration for core modules & shim registry

import { PRELOADED_MODULE_IDS, type Framework } from '@mdx-preview/shared';
import type { ModuleRegistry } from '../registry/ModuleRegistry';
import { preloadCoreModules } from './core';
import { PRELOADED_SHIM_IDS } from './aliases.generated';
import {
  preloadGenericShims,
  FRAMEWORK_LOADERS,
  preloadAllShims,
} from './preload.generated';
import { debug } from '../../utils/debug';

export { fallbackLayoutModule } from './core';
export { PRELOAD_ALIASES, PRELOADED_SHIM_IDS } from './aliases.generated';

// track which framework shims have been loaded
let loadedFramework: Framework | null = null;
let frameworkLoadPromise: Promise<void> | null = null;

// initialize preloaded modules in the registry
// only loads core modules and generic shims synchronously
// framework-specific shims are loaded lazily via ensureFrameworkShims
export function initPreloadedModules(
  registry: ModuleRegistry,
  vscodeMarkdownLayout: unknown
): void {
  preloadCoreModules(registry, vscodeMarkdownLayout);
  preloadGenericShims(registry);
  debug('[PRELOAD] Core modules and generic shims initialized');
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
    return;
  }

  debug(`[PRELOAD] Loading ${framework} shims...`);
  frameworkLoadPromise = loader(registry);
  await frameworkLoadPromise;
  loadedFramework = framework;
  frameworkLoadPromise = null;
  debug(`[PRELOAD] ${framework} shims loaded successfully`);
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
