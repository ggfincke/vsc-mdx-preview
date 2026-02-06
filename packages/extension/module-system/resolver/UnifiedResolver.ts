// packages/extension/module-system/resolver/UnifiedResolver.ts
// unified module resolution combining framework aliases, TypeScript paths, & enhanced-resolve

import { resolveAlias, isBuiltInShim } from './alias-resolver';
import { createTaggedLogger } from '../../logging';
import { isNpmModuleId, LogTags } from '@mdx-preview/shared';
import { createResettableSingleton } from '../../utils/singleton-factory';
import { buildShimResolutionResult } from './resolution-builders';
import {
  getTypeScriptPathStrategy,
  getEnhancedResolveStrategy,
  getFileProbeStrategy,
} from './strategies';
import {
  ResolutionStrategy,
  type ResolutionContext,
  type ResolutionResult,
  type ResolutionMode,
} from '../../types';

// module-level tagged logger for unified resolver
const log = createTaggedLogger(LogTags.UNIFIED_RESOLVER);

// result of framework alias resolution step
export interface FrameworkAliasResult {
  // rewritten specifier
  specifier: string;
  // early result for shims
  earlyResult?: ResolutionResult;
}

// check if specifier is a relative import
function isRelativeImport(specifier: string): boolean {
  return specifier.startsWith('./') || specifier.startsWith('../');
}

// resolve framework alias for bare imports
// extracted to share between sync & async methods
export function resolveFrameworkAliasStep(
  specifier: string,
  context: ResolutionContext
): FrameworkAliasResult {
  if (
    !context.framework ||
    !context.shimsEnabled ||
    isRelativeImport(specifier)
  ) {
    return { specifier };
  }

  const aliasedPath = resolveAlias(
    specifier,
    context.framework,
    context.workspaceRoot ?? context.baseDir
  );

  if (aliasedPath === null) {
    return { specifier };
  }

  if (isBuiltInShim(aliasedPath)) {
    log.debug(
      `Strategy: ${ResolutionStrategy.FrameworkShim} | ${specifier} -> ${aliasedPath}`
    );
    return {
      specifier,
      earlyResult: buildShimResolutionResult(
        aliasedPath,
        specifier,
        ResolutionStrategy.FrameworkShim
      ),
    };
  }

  // alias resolved to a path - continue w/ that path
  log.debug(`Framework alias (non-shim): ${specifier} -> ${aliasedPath}`);
  return { specifier: aliasedPath };
}

// UnifiedResolver - orchestrate 4 resolution strategies in priority order
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
    if (isNpmModuleId(specifier)) {
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
    const aliasResult = resolveFrameworkAliasStep(specifier, context);
    if (aliasResult.earlyResult) {
      return aliasResult.earlyResult;
    }
    specifier = aliasResult.specifier;

    // step 2: TypeScript path resolution (for non-relative imports)
    if (context.tsConfig && !this.isRelativeImport(specifier)) {
      const result = getTypeScriptPathStrategy().resolve(
        specifier,
        context,
        mode
      );
      if (result) {
        return result;
      }
    }

    // step 3: enhanced-resolve (for node_modules)
    if (!this.isRelativeImport(specifier)) {
      const result = getEnhancedResolveStrategy().resolve(
        specifier,
        context,
        mode
      );
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

    log.debug(`Could not resolve: ${specifier} from ${context.baseDir}`);
    return null;
  }

  // I.3: asynchronous resolution w/ parallel file probing
  async resolveAsync(
    specifier: string,
    context: ResolutionContext,
    mode: ResolutionMode = 'dependency'
  ): Promise<ResolutionResult | null> {
    if (!this.shouldResolve(specifier)) {
      return null;
    }

    // step 1: framework alias resolution (for bare imports only) - sync, no I/O
    const aliasResult = resolveFrameworkAliasStep(specifier, context);
    if (aliasResult.earlyResult) {
      return aliasResult.earlyResult;
    }
    specifier = aliasResult.specifier;

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
      const result = getEnhancedResolveStrategy().resolve(
        specifier,
        context,
        mode
      );
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

    log.debug(`Could not resolve: ${specifier} from ${context.baseDir}`);
    return null;
  }
}

// singleton instance (resettable for testing)
// exported for subsystem registration (resolver-subsystem.ts)
export const unifiedResolverSingleton = createResettableSingleton(
  () => new UnifiedResolver()
);

// get the shared UnifiedResolver instance
export const getUnifiedResolver = unifiedResolverSingleton.get;

// reset resolver (for testing)
export const resetUnifiedResolver = unifiedResolverSingleton.reset;
