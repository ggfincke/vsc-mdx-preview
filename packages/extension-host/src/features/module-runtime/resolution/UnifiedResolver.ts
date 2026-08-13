// packages/extension-host/src/features/module-runtime/resolution/UnifiedResolver.ts
// unified module resolution combining framework aliases, TypeScript paths, & enhanced-resolve

import { resolveAlias, isBuiltInShim } from './alias-resolver';
import { createTaggedLogger } from '../../../shared/logging/logger';
import { LogTags } from '@mdx-preview/contracts';
import {
  isNpmModuleId,
  isValidModuleRequest,
} from '@mdx-preview/runtime-utils';
import { createResettableSingleton } from '../../../shared/utils/singleton-factory';
import { buildShimResolutionResult } from './resolution-builders';
import { isNodeModulesPath } from './file-prober';
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
} from '../types/module-system';
import type { IResolutionStrategy } from '../types/resolver/strategies';

// module-level tagged logger for unified resolver
const log = createTaggedLogger(LogTags.UNIFIED_RESOLVER);

// result of framework alias resolution step
export interface FrameworkAliasResult {
  // rewritten specifier
  specifier: string;
  // early result for shims
  earlyResult?: ResolutionResult;
}

// lazy strategy getter + async preference for one chain step
interface StrategyDescriptor {
  readonly getStrategy: () => IResolutionStrategy;
  readonly preferAsync: boolean;
}

// precomputed strategy chains
const RELATIVE_CHAIN: readonly StrategyDescriptor[] = [
  { getStrategy: getFileProbeStrategy, preferAsync: true },
];
const NODE_MODULE_RELATIVE_CHAIN: readonly StrategyDescriptor[] = [
  { getStrategy: getEnhancedResolveStrategy, preferAsync: true },
];
const BARE_TS_CHAIN: readonly StrategyDescriptor[] = [
  { getStrategy: getTypeScriptPathStrategy, preferAsync: true },
  { getStrategy: getEnhancedResolveStrategy, preferAsync: true },
];
const BARE_CHAIN: readonly StrategyDescriptor[] = [BARE_TS_CHAIN[1]];

// check if specifier is a relative import
function isRelativeImport(specifier: string): boolean {
  return specifier.startsWith('./') || specifier.startsWith('../');
}

// pick the constant strategy chain for a specifier & context
function pickChain(
  specifier: string,
  context: ResolutionContext
): readonly StrategyDescriptor[] {
  if (isRelativeImport(specifier)) {
    return isNodeModulesPath(context.baseDir)
      ? NODE_MODULE_RELATIVE_CHAIN
      : RELATIVE_CHAIN;
  }
  return context.tsConfig ? BARE_TS_CHAIN : BARE_CHAIN;
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
  // delegate to module-level function for consistency
  isRelativeImport(specifier: string): boolean {
    return isRelativeImport(specifier);
  }

  // apply the shared request policy before any strategy can observe the value
  shouldResolve(specifier: unknown): specifier is string {
    return (
      typeof specifier === 'string' &&
      specifier.length > 0 &&
      isValidModuleRequest(specifier) &&
      !isNpmModuleId(specifier)
    );
  }

  // prepare alias resolution & strategy chain (shared between sync & async)
  private prepareResolution(
    specifier: string,
    context: ResolutionContext
  ):
    | { earlyResult: ResolutionResult }
    | {
        specifier: string;
        chain: readonly StrategyDescriptor[];
      } {
    const aliasResult = resolveFrameworkAliasStep(specifier, context);
    if (aliasResult.earlyResult) {
      return { earlyResult: aliasResult.earlyResult };
    }
    const s = aliasResult.specifier;
    return { specifier: s, chain: pickChain(s, context) };
  }

  private resolvePlannedStrategiesSync(
    specifier: string,
    context: ResolutionContext,
    mode: ResolutionMode,
    chain: readonly StrategyDescriptor[]
  ): ResolutionResult | null {
    for (const { getStrategy } of chain) {
      const result = getStrategy().resolve(specifier, context, mode);
      if (result) {
        return result;
      }
    }
    return null;
  }

  private async resolvePlannedStrategiesAsync(
    specifier: string,
    context: ResolutionContext,
    mode: ResolutionMode,
    chain: readonly StrategyDescriptor[]
  ): Promise<ResolutionResult | null> {
    for (const { getStrategy, preferAsync } of chain) {
      const strategy = getStrategy();
      const result =
        preferAsync && strategy.resolveAsync
          ? await strategy.resolveAsync(specifier, context, mode)
          : strategy.resolve(specifier, context, mode);
      if (result) {
        return result;
      }
    }
    return null;
  }

  // resolve after alias (sync)
  private resolveAfterAliasSync(
    specifier: string,
    context: ResolutionContext,
    mode: ResolutionMode
  ): ResolutionResult | null {
    const prep = this.prepareResolution(specifier, context);
    if ('earlyResult' in prep) {
      return prep.earlyResult;
    }

    const { specifier: s, chain } = prep;
    return this.resolvePlannedStrategiesSync(s, context, mode, chain);
  }

  // resolve after alias (async)
  private async resolveAfterAliasAsync(
    specifier: string,
    context: ResolutionContext,
    mode: ResolutionMode
  ): Promise<ResolutionResult | null> {
    const prep = this.prepareResolution(specifier, context);
    if ('earlyResult' in prep) {
      return prep.earlyResult;
    }

    const { specifier: s, chain } = prep;
    return this.resolvePlannedStrategiesAsync(s, context, mode, chain);
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

    const result = this.resolveAfterAliasSync(specifier, context, mode);
    if (result) {
      return result;
    }

    log.debug(`Could not resolve: ${specifier} from ${context.baseDir}`);
    return null;
  }

  // asynchronous resolution w/ parallel file probing
  async resolveAsync(
    specifier: string,
    context: ResolutionContext,
    mode: ResolutionMode = 'dependency'
  ): Promise<ResolutionResult | null> {
    if (!this.shouldResolve(specifier)) {
      return null;
    }

    const result = await this.resolveAfterAliasAsync(specifier, context, mode);
    if (result) {
      return result;
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
