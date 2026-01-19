// packages/webview-app/src/module-system/runtime/require.ts
// Synchronous require factory for module evaluation

import { registry } from '../registry/ModuleRegistry';
import { PRELOAD_ALIASES } from '../preload';

// create a synchronous require function bound to a parent module
// used during module evaluation to resolve already-loaded dependencies
//
// resolution order:
// 1. direct cache hit on the request string
// 2. resolution map lookup (for relative imports resolved from parent)
// 3. PRELOAD_ALIASES lookup
// 4. npm://* prefixed versions
// 5. throws error if not found
//
// parentId: the ID of the module doing the require
// returns: a sync require function for use in module evaluation
export function createSyncRequire(
  parentId: string
): (request: string) => unknown {
  return (request: string): unknown => {
    // 1. Direct cache hit
    const cached = registry.get(request);
    if (cached) {
      return cached.exports;
    }

    // 2. Resolution map for relative imports resolved from this parent
    const resolvedPath = registry.getResolution(parentId, request);
    if (resolvedPath) {
      const resolvedModule = registry.get(resolvedPath);
      if (resolvedModule) {
        return resolvedModule.exports;
      }
    }

    // 3. Alias lookup
    const aliasId = PRELOAD_ALIASES[request];
    if (aliasId) {
      const aliased = registry.get(aliasId);
      if (aliased) {
        return aliased.exports;
      }
    }

    // 4. npm:// prefixed fallback
    const npmId = `npm://${request}@latest`;
    const npmCached = registry.get(npmId);
    if (npmCached) {
      return npmCached.exports;
    }

    // Module not found (should have been pre-fetched)
    throw new Error(
      `Module not found: "${request}" (required by "${parentId}"). ` +
        `Make sure all dependencies are fetched before evaluation.`
    );
  };
}
