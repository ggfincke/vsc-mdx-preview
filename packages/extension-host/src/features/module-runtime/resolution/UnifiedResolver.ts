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

  private buildSyncSteps(
    specifier: string,
    context: ResolutionContext,
    mode: ResolutionMode
  ): SyncResolutionStep[] {
    const steps: SyncResolutionStep[] = [];
    const isRelative = this.isRelativeImport(specifier);

    if (context.tsConfig && !isRelative) {
      steps.push(() =>
        getTypeScriptPathStrategy().resolve(specifier, context, mode)
      );
    }

    if (!isRelative) {
      steps.push(() =>
        getEnhancedResolveStrategy().resolve(specifier, context, mode)
      );
    }

    if (isRelative) {
      steps.push(() =>
        getFileProbeStrategy().resolve(specifier, context, mode)
      );
    }

    return steps;
  }

  private buildAsyncSteps(
    specifier: string,
    context: ResolutionContext,
    mode: ResolutionMode
  ): AsyncResolutionStep[] {
    const steps: AsyncResolutionStep[] = [];
    const isRelative = this.isRelativeImport(specifier);

    if (context.tsConfig && !isRelative) {
      steps.push(async () => {
        const strategy = getTypeScriptPathStrategy();
        return strategy.resolveAsync
          ? strategy.resolveAsync(specifier, context, mode)
          : strategy.resolve(specifier, context, mode);
      });
    }

    if (!isRelative) {
      steps.push(async () =>
        getEnhancedResolveStrategy().resolve(specifier, context, mode)
      );
    }

    if (isRelative) {
      steps.push(async () => {
        const strategy = getFileProbeStrategy();
        return strategy.resolveAsync
          ? strategy.resolveAsync(specifier, context, mode)
          : strategy.resolve(specifier, context, mode);
      });
    }

    return steps;
  }

  private resolveAfterAliasSync(
    specifier: string,
    context: ResolutionContext,
    mode: ResolutionMode
  ): ResolutionResult | null {
    const aliasResult = resolveFrameworkAliasStep(specifier, context);
    if (aliasResult.earlyResult) {
      return aliasResult.earlyResult;
    }

    return runSyncSteps(
      this.buildSyncSteps(aliasResult.specifier, context, mode)
    );
  }

  private async resolveAfterAliasAsync(
    specifier: string,
    context: ResolutionContext,
    mode: ResolutionMode
  ): Promise<ResolutionResult | null> {
    const aliasResult = resolveFrameworkAliasStep(specifier, context);
    if (aliasResult.earlyResult) {
      return aliasResult.earlyResult;
    }

    return runAsyncSteps(
      this.buildAsyncSteps(aliasResult.specifier, context, mode)
    );
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

  // I.3: asynchronous resolution w/ parallel file probing
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
