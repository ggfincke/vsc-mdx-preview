// packages/webview-client/src/features/module-runtime/index.ts
// thin adapter: configure mdx-forge runtime w/ VS Code-specific bindings

import * as forgeBrowser from 'mdx-forge/browser';
import type { ModuleRegistry } from 'mdx-forge/browser/registry';
import type {
  FetchResult,
  FrameworkId,
  ModuleDependency,
  ModuleDependencyKind,
} from '@mdx-preview/contracts';
import { isBareImport } from '@mdx-preview/runtime-utils';
import { ExtensionHandle } from '../../platform/rpc/webview-rpc-client';
import {
  initPreloadedModules,
  ensureFrameworkShims,
  ensureGenericShims,
  getRequestedFramework,
} from './preload';
import { resolveRegisteredPreloadAlias } from './preload/core';

const IMPORT_RUNTIME_PREFIX = '\0mdx-forge:import\0';

interface ForgeFetchResult {
  fsPath: string;
  code: string;
  dependencies: unknown[];
  css?: string;
}

type ForgeModuleFetcher = (
  request: string,
  isBare: boolean,
  parentId: string,
  kind?: ModuleDependencyKind
) => Promise<ForgeFetchResult | undefined>;

interface ForgeBrowserRuntime {
  createImportRuntimeRequest?: (specifier: string) => string;
  evaluateModuleToComponent(
    code: string,
    entryFilePath: string,
    dependencies: unknown[]
  ): Promise<(...args: unknown[]) => unknown>;
  registry: ModuleRegistry;
  setModuleFetcher(fetcher: ForgeModuleFetcher): void;
}

type ExtensionModuleFetcher = (
  request: string,
  isBare: boolean,
  parentId: string,
  kind?: ModuleDependencyKind
) => Promise<FetchResult | undefined>;

interface ForgeRuntimeAdapter {
  evaluateModuleToComponent(
    code: string,
    entryFilePath: string,
    dependencies: ModuleDependency[]
  ): Promise<(...args: unknown[]) => unknown>;
}

interface ForgeCacheRuntime {
  clearAllCaches(): void;
  ensureFrameworkShimsLoaded(framework: FrameworkId): void;
}

type PreloadAliasResolver = (specifier: string) => string | undefined;

function decodeLegacyRuntimeRequest(runtimeRequest: string): {
  request: string;
  kind: ModuleDependencyKind;
} {
  if (runtimeRequest.startsWith(IMPORT_RUNTIME_PREFIX)) {
    return {
      request: runtimeRequest.slice(IMPORT_RUNTIME_PREFIX.length),
      kind: 'import',
    };
  }
  return { request: runtimeRequest, kind: 'require' };
}

function toLegacyRuntimeRequest(
  dependency: ModuleDependency,
  parentId: string,
  runtime: ForgeBrowserRuntime,
  resolvePreloadAlias: PreloadAliasResolver
): string {
  const preloadId = resolvePreloadAlias(dependency.specifier);
  if (preloadId === undefined) {
    return dependency.runtimeRequest;
  }
  // bind tagged imports to the canonical preloaded module
  if (dependency.runtimeRequest !== dependency.specifier) {
    runtime.registry.setResolution(
      parentId,
      dependency.runtimeRequest,
      preloadId
    );
  }
  return dependency.specifier;
}

function toLegacyDependencies(
  dependencies: ModuleDependency[],
  parentId: string,
  runtime: ForgeBrowserRuntime,
  resolvePreloadAlias: PreloadAliasResolver
): string[] {
  const legacyDependencies = new Array<string>(dependencies.length);
  for (const [index, dependency] of dependencies.entries()) {
    // defer alias resolution until old Forge initializes host preloads
    Object.defineProperty(legacyDependencies, index, {
      configurable: true,
      enumerable: true,
      get: () =>
        toLegacyRuntimeRequest(
          dependency,
          parentId,
          runtime,
          resolvePreloadAlias
        ),
    });
  }
  return legacyDependencies;
}

function toLegacyFetchResult(
  result: FetchResult,
  runtime: ForgeBrowserRuntime,
  resolvePreloadAlias: PreloadAliasResolver
): ForgeFetchResult {
  return {
    ...result,
    dependencies: result.dependencies.map((dependency) =>
      toLegacyRuntimeRequest(
        dependency,
        result.fsPath,
        runtime,
        resolvePreloadAlias
      )
    ),
  };
}

export function createForgeRuntimeAdapter(
  runtime: ForgeBrowserRuntime,
  extensionFetch: ExtensionModuleFetcher,
  resolvePreloadAlias: PreloadAliasResolver
): ForgeRuntimeAdapter {
  if (typeof runtime.createImportRuntimeRequest === 'function') {
    runtime.setModuleFetcher((request, isBare, parentId, kind) =>
      extensionFetch(request, isBare, parentId, kind)
    );
    return {
      evaluateModuleToComponent: (code, entryFilePath, dependencies) =>
        runtime.evaluateModuleToComponent(code, entryFilePath, dependencies),
    };
  }

  runtime.setModuleFetcher(async (runtimeRequest, _isBare, parentId) => {
    const { request, kind } = decodeLegacyRuntimeRequest(runtimeRequest);
    const result = await extensionFetch(
      request,
      isBareImport(request),
      parentId,
      kind
    );
    return result
      ? toLegacyFetchResult(result, runtime, resolvePreloadAlias)
      : undefined;
  });
  return {
    evaluateModuleToComponent: (code, entryFilePath, dependencies) =>
      runtime.evaluateModuleToComponent(
        code,
        entryFilePath,
        toLegacyDependencies(
          dependencies,
          entryFilePath,
          runtime,
          resolvePreloadAlias
        )
      ),
  };
}

const forgeRuntime = forgeBrowser as unknown as ForgeBrowserRuntime;
const forgeRuntimeAdapter = createForgeRuntimeAdapter(
  forgeRuntime,
  (request, isBare, parentId, kind) =>
    ExtensionHandle.fetch(request, isBare, parentId, kind),
  (specifier) => resolveRegisteredPreloadAlias(forgeRuntime.registry, specifier)
);

// configure preload - provide real shim loading implementations
// (replaces mdx-forge's no-op stubs w/ VS Code-specific retry logic,
// generated preload entries, & framework CSS loading)
forgeBrowser.setHostPreloadCallbacks({
  initPreloadedModules,
  ensureFrameworkShims,
  ensureGenericShims,
});

export function clearForgeRuntimeCaches(
  runtime: ForgeCacheRuntime,
  requestedFramework: FrameworkId | null
): void {
  runtime.clearAllCaches();
  if (requestedFramework !== null) {
    runtime.ensureFrameworkShimsLoaded(requestedFramework);
  }
}

export function clearAllCaches(): void {
  clearForgeRuntimeCaches(
    forgeBrowser as unknown as ForgeCacheRuntime,
    getRequestedFramework()
  );
}

// re-export mdx-forge's full API for webview consumers
export {
  ensureFrameworkShimsLoaded,
  ensureGenericShimsLoaded,
  invalidateModule,
  invalidateModuleWithDependents,
  resetModules,
  resetDependencies,
  registry,
  clearInjectedStyles,
  loadModule,
} from 'mdx-forge/browser';

export type { Module, ModuleRuntime } from 'mdx-forge/browser';
export type {
  FetchResult,
  ModuleDependency,
  ModuleDependencyKind,
} from '@mdx-preview/contracts';

// adapt the independently versioned Forge contract
export function evaluateModuleToComponent(
  code: string,
  entryFilePath: string,
  dependencies: ModuleDependency[]
): Promise<(...args: unknown[]) => unknown> {
  return forgeRuntimeAdapter.evaluateModuleToComponent(
    code,
    entryFilePath,
    dependencies
  );
}
