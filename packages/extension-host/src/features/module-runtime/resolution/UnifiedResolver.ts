// packages/extension-host/src/features/module-runtime/resolution/UnifiedResolver.ts
// unified module resolution combining framework aliases, TypeScript paths, & enhanced-resolve

import { resolveAlias, isBuiltInShim } from './alias-resolver';
import { createTaggedLogger } from '../../../shared/logging/logger';
import { LogTags } from '@mdx-preview/contracts';
import { isNpmModuleId } from '@mdx-preview/runtime-utils';
import { createResettableSingleton } from '../../../shared/utils/singleton-factory';
import { buildShimResolutionResult } from './resolution-builders';
import {
  getTypeScriptPathStrategy,
  getEnhancedResolveStrategy,
  getFileProbeStrategy,
} from './strategies';
import {
  ResolutionStrategy,
  type IResolutionStrategy,
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

type SyncResolutionStep = () => ResolutionResult | null;
type AsyncResolutionStep = () => Promise<ResolutionResult | null>;

// check if specifier is a relative import
function isRelativeImport(specifier: string): boolean {
  return specifier.startsWith('./') || specifier.startsWith('../');
}

function runSyncSteps(steps: SyncResolutionStep[]): ResolutionResult | null {
  for (const step of steps) {
    const result = step();
    if (result) {
      return result;
    }
  }
  return null;
}

async function runAsyncSteps(
  steps: AsyncResolutionStep[]
): Promise<ResolutionResult | null> {
  for (const step of steps) {
    const result = await step();
    if (result) {
      return result;
    }
  }
  return null;
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

  // determine which strategies to try based on specifier type & context
  private getStrategyPlan(
    specifier: string,
    context: ResolutionContext
  ): {
    useTypeScript: boolean;
    useEnhancedResolve: boolean;
    useFileProbe: boolean;
  } {
    const isRelative = this.isRelativeImport(specifier);
    return {
      useTypeScript: Boolean(context.tsConfig) && !isRelative,
      useEnhancedResolve: !isRelative,
      useFileProbe: isRelative,
    };
  }

  // prepare alias resolution & strategy plan (shared between sync & async)
  private prepareResolution(
    specifier: string,
    context: ResolutionContext
  ):
    | { earlyResult: ResolutionResult }
    | {
        specifier: string;
        plan: ReturnType<UnifiedResolver['getStrategyPlan']>;
      } {
    const aliasResult = resolveFrameworkAliasStep(specifier, context);
    if (aliasResult.earlyResult) {
      return { earlyResult: aliasResult.earlyResult };
    }
    const s = aliasResult.specifier;
    return { specifier: s, plan: this.getStrategyPlan(s, context) };
  }

  // describe which strategies to invoke (shared between sync & async)
  private buildStrategyDescriptors(plan: {
    useTypeScript: boolean;
    useEnhancedResolve: boolean;
    useFileProbe: boolean;
  }): Array<{
    getStrategy: () => IResolutionStrategy;
    preferAsync: boolean;
  }> {
    const descriptors: Array<{
      getStrategy: () => IResolutionStrategy;
      preferAsync: boolean;
    }> = [];
    if (plan.useTypeScript) {
      descriptors.push({
        getStrategy: getTypeScriptPathStrategy,
        preferAsync: true,
      });
    }
    if (plan.useEnhancedResolve) {
      descriptors.push({
        getStrategy: getEnhancedResolveStrategy,
        preferAsync: false,
      });
    }
    if (plan.useFileProbe) {
      descriptors.push({
        getStrategy: getFileProbeStrategy,
        preferAsync: true,
      });
    }
    return descriptors;
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

    const { specifier: s, plan } = prep;
    const descriptors = this.buildStrategyDescriptors(plan);
    const steps: SyncResolutionStep[] = descriptors.map(
      (d) => () => d.getStrategy().resolve(s, context, mode)
    );
    return runSyncSteps(steps);
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

    const { specifier: s, plan } = prep;
    const descriptors = this.buildStrategyDescriptors(plan);
    const steps: AsyncResolutionStep[] = descriptors.map((d) => async () => {
      const strategy = d.getStrategy();
      return d.preferAsync && strategy.resolveAsync
        ? strategy.resolveAsync(s, context, mode)
        : strategy.resolve(s, context, mode);
    });
    return runAsyncSteps(steps);
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
