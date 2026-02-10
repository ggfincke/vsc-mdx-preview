// packages/webview-app/src/module-system/loader/loadModule.ts
// core recursive module loading logic w/ parallel dependency fetching

import { isBareImport } from '../internal/module-id';
import { Semaphore } from '../internal/semaphore';
import { getModuleLoaderConfig } from '../internal/runtime-config';
import { registry } from '../registry/ModuleRegistry';
import { evaluateModule } from '../eval/evaluateModule';
import { injectStyles } from '../styles/injectStyles';
import { createSyncRequire } from '../runtime/require';
import {
  createModuleNotFoundError,
  createModuleDepthExceededError,
} from '../errors';
import type {
  Module,
  ModuleRuntime,
  ModuleFetcher,
  FetchResult,
} from '../types';

// circular dependency helpers (see circular.ts for details)
import {
  getPendingModule,
  registerPendingModule,
  clearPendingModule,
} from './circular';

// track in-flight fetches to deduplicate parallel requests
// key: "parentId\0dep" to correctly handle relative specifiers
// (same relative specifier from different parents can resolve to different files)
const inFlightFetches = new Map<string, Promise<FetchResult | undefined>>();

function makeInFlightKey(parentId: string, dep: string): string {
  return `${parentId}\0${dep}`;
}

function getPreloadAliasMap(): Record<string, string> {
  return getModuleLoaderConfig().preloadAliases;
}

let fetchSemaphore = new Semaphore(
  getModuleLoaderConfig().maxConcurrentFetches
);
let semaphoreConcurrency = getModuleLoaderConfig().maxConcurrentFetches;

function getFetchSemaphore(): Semaphore {
  const configured = getModuleLoaderConfig().maxConcurrentFetches;
  if (configured !== semaphoreConcurrency) {
    fetchSemaphore = new Semaphore(configured);
    semaphoreConcurrency = configured;
  }
  return fetchSemaphore;
}

// recursively load a module & all its dependencies
// track depth to prevent stack overflow from deep dependency chains
export async function loadModule(
  id: string,
  code: string,
  dependencies: string[],
  fetcher: ModuleFetcher,
  depth: number = 0
): Promise<Module> {
  const config = getModuleLoaderConfig();

  // check depth limit (prevents stack overflow)
  if (depth > config.maxModuleLoadDepth) {
    throw createModuleDepthExceededError(id, depth);
  }

  // check cache
  const cached = registry.get(id);
  if (cached) {
    return cached;
  }

  // check for circular dependency (pending fetch)
  // if this module is already being loaded, return the in-flight promise
  const pending = getPendingModule(id);
  if (pending) {
    return pending;
  }

  // create promise for this module
  const modulePromise = loadModuleAsync(id, code, dependencies, fetcher, depth);

  // register as pending for circular dependency detection
  registerPendingModule(id, modulePromise);

  try {
    return await modulePromise;
  } finally {
    // always clear pending state when done (success or failure)
    clearPendingModule(id);
  }
}

// internal async loading logic w/ parallel dependency fetching
async function loadModuleAsync(
  id: string,
  code: string,
  dependencies: string[],
  fetcher: ModuleFetcher,
  depth: number
): Promise<Module> {
  // phase 1: categorize dependencies (cached vs needs fetching)
  interface ToFetch {
    dep: string;
    isBare: boolean;
  }

  const toFetch: ToFetch[] = [];

  for (const dep of dependencies) {
    if (!dep) {
      continue;
    }

    // skip if already loaded (but still record dependency)
    if (registry.has(dep)) {
      registry.addDependency(id, dep);
      continue;
    }

    // check aliases (but still record dependency)
    const aliasId = getPreloadAliasMap()[dep];
    if (aliasId && registry.has(aliasId)) {
      registry.addDependency(id, aliasId);
      continue;
    }

    // determine if this is bare import (use shared utility)
    const isBare = isBareImport(dep);

    toFetch.push({ dep, isBare });
  }

  // phase 2: parallel fetch all non-cached dependencies
  interface FetchedResult {
    dep: string;
    result: FetchResult | undefined;
  }

  const fetchPromises = toFetch.map(
    async ({ dep, isBare }): Promise<FetchedResult> => {
      const inFlightKey = makeInFlightKey(id, dep);

      // check for in-flight fetch w/ same (parent, dep) pair
      let fetchPromise = inFlightFetches.get(inFlightKey);
      if (!fetchPromise) {
        // acquire semaphore permit (limits concurrent fetches)
        const semaphore = getFetchSemaphore();
        await semaphore.acquire();
        try {
          fetchPromise = fetcher(dep, isBare, id);
          inFlightFetches.set(inFlightKey, fetchPromise);
          // clean up on completion (success or failure)
          fetchPromise.finally(() => {
            inFlightFetches.delete(inFlightKey);
            semaphore.release();
          });
        } catch (e) {
          semaphore.release();
          throw e;
        }
      }

      const result = await fetchPromise;
      return { dep, result };
    }
  );

  // wait for all fetches in parallel (main performance win)
  const fetchResults = await Promise.all(fetchPromises);

  // phase 3: handle fetch errors
  const failed = fetchResults.filter((r) => !r.result);
  if (failed.length > 0) {
    const firstFailed = failed[0];
    throw createModuleNotFoundError(firstFailed.dep, id);
  }

  // phase 4: process results & CSS (sequential for injection order)
  // then queue parallel recursive loads for non-CSS dependencies
  const loadPromises: Promise<void>[] = [];

  for (const { dep, result } of fetchResults) {
    // type guard: result is guaranteed non-null after phase 3
    if (!result) {
      continue;
    }

    // register resolution mapping: (parentId, request) -> fsPath
    if (result.fsPath !== dep) {
      registry.setResolution(id, dep, result.fsPath);
    }

    // check if the resolved path is an alias to a preloaded module
    const preloadId = getPreloadAliasMap()[result.fsPath];
    if (preloadId && registry.has(preloadId)) {
      registry.setResolution(id, dep, preloadId);
      registry.addDependency(id, preloadId);
      continue;
    }

    // handle CSS - inject synchronously to preserve cascade order
    if (result.css) {
      injectStyles(result.fsPath, result.css);
      registry.set(result.fsPath, {
        id: result.fsPath,
        exports: {},
        loaded: true,
      });
      registry.addDependency(id, result.fsPath);
      continue;
    }

    // queue recursive load (will run in parallel)
    // pass depth + 1 to track recursion depth
    loadPromises.push(
      loadModule(
        result.fsPath,
        result.code,
        result.dependencies,
        fetcher,
        depth + 1
      ).then(() => {
        registry.addDependency(id, result.fsPath);
      })
    );
  }

  // phase 5: wait for all recursive loads (parallel)
  await Promise.all(loadPromises);

  // phase 6: evaluate this module now that all dependencies are loaded
  const runtimeBase = getModuleLoaderConfig().runtime;
  const runtime: ModuleRuntime = {
    Fragment: runtimeBase.Fragment,
    jsx: runtimeBase.jsx,
    jsxs: runtimeBase.jsxs,
    jsxDEV: runtimeBase.jsxDEV,
    useMDXComponents: runtimeBase.useMDXComponents,
    require: createSyncRequire(id),
  };

  const exports = evaluateModule(code, id, runtime);

  const module: Module = {
    id,
    exports,
    loaded: true,
  };
  registry.set(id, module);

  return module;
}
