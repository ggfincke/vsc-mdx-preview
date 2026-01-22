// packages/webview-app/src/module-system/loader/loadModule.ts
// Core recursive module loading logic

import * as jsxRuntime from 'react/jsx-runtime';
import { registry } from '../registry/ModuleRegistry';
import { evaluateModule } from '../eval/evaluateModule';
import { injectStyles } from '../styles/injectStyles';
import { createSyncRequire } from '../runtime/require';
import { PRELOAD_ALIASES } from '../preload';
import type { Module, ModuleRuntime, ModuleFetcher } from '../types';

// circular dependency helpers (see circular.ts for details)
import {
  getPendingModule,
  registerPendingModule,
  clearPendingModule,
} from './circular';

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

// internal async loading logic
async function loadModuleAsync(
  id: string,
  code: string,
  dependencies: string[],
  fetcher: ModuleFetcher
): Promise<Module> {
  // Load all dependencies
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
    if (PRELOAD_ALIASES[dep] && registry.has(PRELOAD_ALIASES[dep])) {
      registry.addDependency(id, PRELOAD_ALIASES[dep]);
      continue;
    }

    // Determine if this is bare import
    const isBare =
      !dep.startsWith('/') &&
      !dep.startsWith('./') &&
      !dep.startsWith('../') &&
      !dep.startsWith('npm://');

    // Fetch dependency
    const result = await fetcher(dep, isBare, id);
    if (!result) {
      // Throw error instead of silently continuing - this surfaces the real problem
      // to the user instead of showing a confusing MDX runtime error later
      throw new Error(
        `Failed to load module: "${dep}"\n` +
          `Required by: ${id}\n\n` +
          `Possible causes:\n` +
          `  - The file does not exist at the specified path\n` +
          `  - The path in .mdx-previewrc.json is incorrect\n` +
          `  - A transpilation error occurred\n\n` +
          `Check the MDX Preview output channel for details.`
      );
    }

    // Register resolution mapping: (parentId, request) -> fsPath
    // This allows require() to find the module by request string
    if (result.fsPath !== dep) {
      registry.setResolution(id, dep, result.fsPath);
    }

    // Handle CSS
    if (result.css) {
      injectStyles(result.fsPath, result.css);
      // CSS modules don't have exports
      registry.set(result.fsPath, {
        id: result.fsPath,
        exports: {},
        loaded: true,
      });
      // Record dependency on CSS module
      registry.addDependency(id, result.fsPath);
      continue;
    }

    // Recursively load dependency
    await loadModule(result.fsPath, result.code, result.dependencies, fetcher);

    // Record dependency relationship (id depends on result.fsPath)
    registry.addDependency(id, result.fsPath);
  }

  // Create runtime for module evaluation
  const runtime: ModuleRuntime = {
    Fragment: jsxRuntime.Fragment,
    jsx: jsxRuntime.jsx,
    jsxs: jsxRuntime.jsxs,
    require: createSyncRequire(id),
  };

  // Evaluate module
  const exports = evaluateModule(code, id, runtime);

  // Cache module
  const module: Module = {
    id,
    exports,
    loaded: true,
  };
  registry.set(id, module);

  return module;
}
