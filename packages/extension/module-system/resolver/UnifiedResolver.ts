// packages/extension/module-system/resolver/UnifiedResolver.ts
// unified module resolution combining framework aliases, TypeScript paths, & enhanced-resolve

import { resolveAlias, isBuiltInShim } from './alias-resolver';
import { debug } from '../../logging';
import { createResettableSingleton } from '../../utils/singleton-factory';
import { buildShimResolutionResult } from './result-builders';

// import strategies
import {
  getTypeScriptPathStrategy,
  getEnhancedResolveStrategy,
  getFileProbeStrategy,
} from './strategies';

// import consolidated types from module-system/types.ts
import {
  ResolutionStrategy,
  type TypeScriptConfiguration,
  type ResolutionContext,
  type ResolutionResult,
  type ResolutionMode,
} from '../types';

// re-export types for backward compatibility
export {
  ResolutionStrategy,
  type TypeScriptConfiguration,
  type ResolutionContext,
  type ResolutionResult,
  type ResolutionMode,
};

// * UnifiedResolver orchestrates 4 resolution strategies in priority order
export class UnifiedResolver {
  // check if specifier is a relative import
  isRelativeImport(specifier: string): boolean {
    return specifier.startsWith('./') || specifier.startsWith('../');
  }

  // check if specifier should be resolved (not a URL or npm: protocol)
  shouldResolve(specifier: string): boolean {
    if (!specifier) {
      return false;
    }
    if (specifier.startsWith('http://') || specifier.startsWith('https://')) {
      return false;
    }
    if (specifier.startsWith('npm://')) {
      return false;
    }
    return true;
  }

  // synchronous resolution
  resolveSync(
    specifier: string,
    context: ResolutionContext,
    mode: ResolutionMode = 'dependency'
  ): ResolutionResult | null {
    if (!this.shouldResolve(specifier)) {
      return null;
    }

    // step 1: framework alias resolution (for bare imports only)
    if (
      context.framework &&
      context.shimsEnabled &&
      !this.isRelativeImport(specifier)
    ) {
      const aliasedPath = resolveAlias(
        specifier,
        context.framework,
        context.workspaceRoot ?? context.baseDir
      );

      if (aliasedPath !== null) {
        if (isBuiltInShim(aliasedPath)) {
          debug(
            `[UNIFIED-RESOLVER] Strategy: ${ResolutionStrategy.FrameworkShim} | ${specifier} -> ${aliasedPath}`
          );
          return buildShimResolutionResult(
            aliasedPath,
            specifier,
            ResolutionStrategy.FrameworkShim
          );
        }
        // alias resolved to a path - continue w/ that path (will use subsequent strategy)
        debug(
          `[UNIFIED-RESOLVER] Framework alias (non-shim): ${specifier} -> ${aliasedPath}`
        );
        specifier = aliasedPath;
      }
    }

    // step 2: TypeScript path resolution (for non-relative imports)
    if (context.tsConfig && !this.isRelativeImport(specifier)) {
      const result = getTypeScriptPathStrategy().resolve(specifier, context, mode);
      if (result) {
        return result;
      }
    }

    // step 3: enhanced-resolve (for node_modules)
    if (!this.isRelativeImport(specifier)) {
      const result = getEnhancedResolveStrategy().resolve(specifier, context, mode);
      if (result) {
        return result;
      }
    }

    // step 4: file probing fallback (for relative imports)
    if (this.isRelativeImport(specifier)) {
      const result = getFileProbeStrategy().resolve(specifier, context, mode);
      if (result) {
        return result;
      }
    }

    debug(
      `[UNIFIED-RESOLVER] Could not resolve: ${specifier} from ${context.baseDir}`
    );
    return null;
  }

  // I.3: asynchronous resolution with parallel file probing
  async resolveAsync(
    specifier: string,
    context: ResolutionContext,
    mode: ResolutionMode = 'dependency'
  ): Promise<ResolutionResult | null> {
    if (!this.shouldResolve(specifier)) {
      return null;
    }

    // step 1: framework alias resolution (for bare imports only) - sync, no I/O
    if (
      context.framework &&
      context.shimsEnabled &&
      !this.isRelativeImport(specifier)
    ) {
      const aliasedPath = resolveAlias(
        specifier,
        context.framework,
        context.workspaceRoot ?? context.baseDir
      );

      if (aliasedPath !== null) {
        if (isBuiltInShim(aliasedPath)) {
          debug(
            `[UNIFIED-RESOLVER] Strategy: ${ResolutionStrategy.FrameworkShim} | ${specifier} -> ${aliasedPath}`
          );
          return buildShimResolutionResult(
            aliasedPath,
            specifier,
            ResolutionStrategy.FrameworkShim
          );
        }
        debug(
          `[UNIFIED-RESOLVER] Framework alias (non-shim): ${specifier} -> ${aliasedPath}`
        );
        specifier = aliasedPath;
      }
    }

    // step 2: TypeScript path resolution (for non-relative imports)
    // I.3: use async resolution for parallel file probing
    if (context.tsConfig && !this.isRelativeImport(specifier)) {
      const strategy = getTypeScriptPathStrategy();
      const result = strategy.resolveAsync
        ? await strategy.resolveAsync(specifier, context, mode)
        : strategy.resolve(specifier, context, mode);
      if (result) {
        return result;
      }
    }

    // step 3: enhanced-resolve (for node_modules) - uses CachedInputFileSystem internally
    if (!this.isRelativeImport(specifier)) {
      const result = getEnhancedResolveStrategy().resolve(specifier, context, mode);
      if (result) {
        return result;
      }
    }

    // step 4: file probing fallback (for relative imports)
    // I.3: use async resolution for parallel file probing
    if (this.isRelativeImport(specifier)) {
      const strategy = getFileProbeStrategy();
      const result = strategy.resolveAsync
        ? await strategy.resolveAsync(specifier, context, mode)
        : strategy.resolve(specifier, context, mode);
      if (result) {
        return result;
      }
    }

    debug(
      `[UNIFIED-RESOLVER] Could not resolve: ${specifier} from ${context.baseDir}`
    );
    return null;
  }
}

// singleton instance (resettable for testing)
const unifiedResolverSingleton = createResettableSingleton(
  () => new UnifiedResolver()
);

// get the shared UnifiedResolver instance
export const getUnifiedResolver = unifiedResolverSingleton.get;

// reset resolver (for testing)
export const resetUnifiedResolver = unifiedResolverSingleton.reset;
