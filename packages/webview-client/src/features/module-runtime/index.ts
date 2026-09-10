// packages/webview-client/src/features/module-runtime/index.ts
// configure mdx-forge runtime w/ VS Code-specific bindings

import * as forgeBrowser from 'mdx-forge/browser';
import { ExtensionHandle } from '../../platform/rpc/webview-rpc-client';
import {
  initPreloadedModules,
  ensureFrameworkShims,
  ensureGenericShims,
  getRequestedFramework,
} from './preload';

forgeBrowser.setModuleFetcher(async (request, isBare, parentId, kind) => {
  const result = await ExtensionHandle.fetch(request, isBare, parentId, kind);
  // load explicit Starlight imports only after the host grants shim resolution
  if (
    result &&
    (result.fsPath === '@mdx-preview/shims/starlight' ||
      result.fsPath.startsWith('@mdx-preview/shims/starlight/'))
  ) {
    await ensureFrameworkShims(forgeBrowser.registry, 'starlight', false);
  }
  return result;
});

// configure VS Code-specific preload behavior
forgeBrowser.setHostPreloadCallbacks({
  initPreloadedModules,
  ensureFrameworkShims,
  ensureGenericShims,
});

export function clearAllCaches(): void {
  forgeBrowser.clearAllCaches();
  const requestedFramework = getRequestedFramework();
  if (requestedFramework === 'generic') {
    forgeBrowser.ensureGenericShimsLoaded([]);
  } else if (requestedFramework !== null) {
    forgeBrowser.ensureFrameworkShimsLoaded(requestedFramework);
  }
}

// expose the runtime surface used by webview consumers
export {
  ensureFrameworkShimsLoaded,
  ensureGenericShimsLoaded,
  invalidateModule,
  invalidateModuleWithDependents,
  resetModules,
  resetDependencies,
  registry,
  clearInjectedStyles,
  evaluateModuleToComponent,
  loadModule,
} from 'mdx-forge/browser';

export type { Module, ModuleRuntime } from 'mdx-forge/browser';
export type {
  FetchResult,
  ModuleDependency,
  ModuleDependencyKind,
} from '@mdx-preview/contracts';
