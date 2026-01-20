// packages/webview-app/src/module-system/preload/index.ts
// preload orchestration for core modules & shim registry

import { PRELOADED_MODULE_IDS } from '@mdx-preview/shared';
import type { ModuleRegistry } from '../registry/ModuleRegistry';
import { preloadCoreModules } from './core';
import { PRELOADED_SHIM_IDS } from './aliases.generated';
import { preloadAllShims } from './preload.generated';

export { fallbackLayoutModule } from './core';
export { PRELOAD_ALIASES, PRELOADED_SHIM_IDS } from './aliases.generated';

// initialize all preloaded modules in the registry
// vscodeMarkdownLayout: the layout module to use (or fallbackLayoutModule)
export function initPreloadedModules(
  registry: ModuleRegistry,
  vscodeMarkdownLayout: unknown
): void {
  preloadCoreModules(registry, vscodeMarkdownLayout);
  preloadAllShims(registry);
}

// get list of all IDs that should be preserved during module reset
export function getPreservedIds(): string[] {
  return [...Object.values(PRELOADED_MODULE_IDS), ...PRELOADED_SHIM_IDS];
}
