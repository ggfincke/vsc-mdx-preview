// packages/webview-app/src/module-system/loader/loadModule.ts
// core recursive module loading logic w/ parallel dependency fetching

import * as jsxRuntime from 'react/jsx-runtime';
import { isBareImport } from '@mdx-preview/shared';
import { registry } from '../registry/ModuleRegistry';
import { evaluateModule } from '../eval/evaluateModule';
import { injectStyles } from '../styles/injectStyles';
import { createSyncRequire } from '../runtime/require';
import { PRELOAD_ALIASES } from '../preload';
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
import { MAX_MODULE_LOAD_DEPTH, MAX_CONCURRENT_FETCHES } from '../../constants';

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

// simple semaphore for concurrency limiting
// prevents resource exhaustion from unbounded parallel fetches
class Semaphore {
  private permits: number;
  private waitQueue: (() => void)[] = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }
    return new Promise((resolve) => this.waitQueue.push(resolve));
  }

  release(): void {
    const next = this.waitQueue.shift();
    if (next) {
      next();
    } else {
      this.permits++;
    }
  }
}

const fetchSemaphore = new Semaphore(MAX_CONCURRENT_FETCHES);

// recursively load a module & all its dependencies
// depth tracks recursion to prevent stack overflow from deep dependency chains
export async function loadModule(
  id: string,
  code: string,
  dependencies: string[],
  fetcher: ModuleFetcher,
  depth: number = 0
): Promise<Module> {
  // check depth limit (prevents stack overflow)
  if (depth > MAX_MODULE_LOAD_DEPTH) {
    throw createModuleDepthExceededError(id, depth);
  }

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
  const modulePromise = loadModuleAsync(id, code, dependencies, fetcher, depth);

  // Register as pending for circular dependency detection
  registerPendingModule(id, modulePromise);

  try {
    return await modulePromise;
  } finally {
    // Always clear pending state when done (success or failure)
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

    // Determine if this is bare import (uses shared utility)
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
        await fetchSemaphore.acquire();
        try {
          fetchPromise = fetcher(dep, isBare, id);
          inFlightFetches.set(inFlightKey, fetchPromise);
          // clean up on completion (success or failure)
          fetchPromise.finally(() => {
            inFlightFetches.delete(inFlightKey);
            fetchSemaphore.release();
          });
        } catch (e) {
          fetchSemaphore.release();
          throw e;
        }
      }

      const result = await fetchPromise;
      return { dep, result };
    }
  );

  // Wait for all fetches in parallel (main performance win)
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
