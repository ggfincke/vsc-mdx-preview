// packages/webview-client/src/features/module-runtime/index.ts
// thin adapter: configure mdx-forge runtime w/ VS Code-specific bindings

import { setModuleFetcher, setHostPreloadCallbacks } from 'mdx-forge/browser';
import { ExtensionHandle } from '../../platform/rpc/webview-rpc-client';
import {
  initPreloadedModules,
  ensureFrameworkShims,
  ensureGenericShims,
} from './preload';

// configure fetcher - delegates module fetch to extension via Comlink RPC
setModuleFetcher((request, isBare, parentId) =>
  ExtensionHandle.fetch(request, isBare, parentId)
);

// configure preload - provide real shim loading implementations
// (replaces mdx-forge's no-op stubs w/ VS Code-specific retry logic,
// generated preload entries, & framework CSS loading)
setHostPreloadCallbacks({
  initPreloadedModules,
  ensureFrameworkShims,
  ensureGenericShims,
});

// re-export mdx-forge's full API for webview consumers
export {
  evaluateModuleToComponent,
  ensureFrameworkShimsLoaded,
  ensureGenericShimsLoaded,
  invalidateModule,
  invalidateModuleWithDependents,
  clearAllCaches,
  resetModules,
  resetDependencies,
  registry,
  clearInjectedStyles,
  loadModule,
} from 'mdx-forge/browser';

export type { FetchResult, Module, ModuleRuntime } from 'mdx-forge/browser';
