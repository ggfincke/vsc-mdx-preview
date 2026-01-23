// packages/webview-app/src/module-system/loader/loadModule.ts
// Core recursive module loading logic with parallel dependency fetching

import * as jsxRuntime from 'react/jsx-runtime';
import { registry } from '../registry/ModuleRegistry';
import { evaluateModule } from '../eval/evaluateModule';
import { injectStyles } from '../styles/injectStyles';
import { createSyncRequire } from '../runtime/require';
import { PRELOAD_ALIASES } from '../preload';
import type { Module, ModuleRuntime, ModuleFetcher, FetchResult } from '../types';

// circular dependency helpers (see circular.ts for details)
import {
  getPendingModule,
  registerPendingModule,
  clearPendingModule,
} from './circular';

// Track in-flight fetches to deduplicate parallel requests
// Key: "parentId\0dep" to correctly handle relative specifiers
// (same relative specifier from different parents can resolve to different files)
const inFlightFetches = new Map<string, Promise<FetchResult | undefined>>();

function makeInFlightKey(parentId: string, dep: string): string {
  return `${parentId}\0${dep}`;
}

// * recursively load a module & all its dependencies
export async function loadModule(
  id: string,
  code: string,
  dependencies: string[],
  fetcher: ModuleFetcher
): Promise<Module> {
  // Check cache
  const cached = registry.get(id);
  if (cached) {
    return cached;
  }

  // Check for circular dependency (pending fetch)
  // If this module is already being loaded, return the in-flight promise
  const pending = getPendingModule(id);
  if (pending) {
    return pending;
  }

  // Create promise for this module
  const modulePromise = loadModuleAsync(id, code, dependencies, fetcher);

  // Register as pending for circular dependency detection
  registerPendingModule(id, modulePromise);

  try {
    return await modulePromise;
  } finally {
    // Always clear pending state when done (success or failure)
    clearPendingModule(id);
  }
}

// internal async loading logic with parallel dependency fetching
async function loadModuleAsync(
  id: string,
  code: string,
  dependencies: string[],
  fetcher: ModuleFetcher
): Promise<Module> {
  // =============================================================================
  // PHASE 1: Categorize dependencies (cached vs needs fetching)
  // =============================================================================
  interface ToFetch {
    dep: string;
    isBare: boolean;
  }

  const toFetch: ToFetch[] = [];

  for (const dep of dependencies) {
    if (!dep) {
      continue;
    }

    // Skip if already loaded (but still record dependency)
    if (registry.has(dep)) {
      registry.addDependency(id, dep);
      continue;
    }

    // Check aliases (but still record dependency)
    const aliasId = PRELOAD_ALIASES[dep];
    if (aliasId && registry.has(aliasId)) {
      registry.addDependency(id, aliasId);
      continue;
    }

    // Determine if this is bare import
    const isBare =
      !dep.startsWith('/') &&
      !dep.startsWith('./') &&
      !dep.startsWith('../') &&
      !dep.startsWith('npm://');

    toFetch.push({ dep, isBare });
  }

  // =============================================================================
  // PHASE 2: Parallel fetch all non-cached dependencies
  // =============================================================================
  interface FetchedResult {
    dep: string;
    result: FetchResult | undefined;
  }

  const fetchPromises = toFetch.map(async ({ dep, isBare }): Promise<FetchedResult> => {
    const inFlightKey = makeInFlightKey(id, dep);

    // Check for in-flight fetch with same (parent, dep) pair
    let fetchPromise = inFlightFetches.get(inFlightKey);
    if (!fetchPromise) {
      fetchPromise = fetcher(dep, isBare, id);
      inFlightFetches.set(inFlightKey, fetchPromise);
      // Clean up on completion (success or failure)
      fetchPromise.finally(() => inFlightFetches.delete(inFlightKey));
    }

    const result = await fetchPromise;
    return { dep, result };
  });

  // Wait for all fetches in parallel (main performance win)
  const fetchResults = await Promise.all(fetchPromises);

  // =============================================================================
  // PHASE 3: Handle fetch errors
  // =============================================================================
  const failed = fetchResults.filter((r) => !r.result);
  if (failed.length > 0) {
    const firstFailed = failed[0];
    throw new Error(
      `Failed to load module: "${firstFailed.dep}"\n` +
        `Required by: ${id}\n\n` +
        `Possible causes:\n` +
        `  - The file does not exist at the specified path\n` +
        `  - The path in .mdx-previewrc.json is incorrect\n` +
        `  - A transpilation error occurred\n\n` +
        `Check the MDX Preview output channel for details.`
    );
  }

  // =============================================================================
  // PHASE 4: Process results & CSS (sequential for injection order)
  // Then queue parallel recursive loads for non-CSS dependencies
  // =============================================================================
  const loadPromises: Promise<void>[] = [];

  for (const { dep, result } of fetchResults) {
    // Type guard: result is guaranteed non-null after Phase 3
    if (!result) {
      continue;
    }

    // Register resolution mapping: (parentId, request) -> fsPath
    if (result.fsPath !== dep) {
      registry.setResolution(id, dep, result.fsPath);
    }

    // Check if the resolved path is an alias to a preloaded module
    const preloadId = PRELOAD_ALIASES[result.fsPath];
    if (preloadId && registry.has(preloadId)) {
      registry.setResolution(id, dep, preloadId);
      registry.addDependency(id, preloadId);
      continue;
    }

    // Handle CSS - inject synchronously to preserve cascade order
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

    // Queue recursive load (will run in parallel)
    loadPromises.push(
      loadModule(result.fsPath, result.code, result.dependencies, fetcher).then(
        () => {
          registry.addDependency(id, result.fsPath);
        }
      )
    );
  }

  // =============================================================================
  // PHASE 5: Wait for all recursive loads (parallel)
  // =============================================================================
  await Promise.all(loadPromises);

  // =============================================================================
  // PHASE 6: Evaluate this module now that all dependencies are loaded
  // =============================================================================
  const runtime: ModuleRuntime = {
    Fragment: jsxRuntime.Fragment,
    jsx: jsxRuntime.jsx,
    jsxs: jsxRuntime.jsxs,
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
