// packages/extension-host/src/features/module-runtime/resolution/strategies/EnhancedResolveStrategy.ts
// node.js-style resolution using enhanced-resolve

import {
  getAsyncBrowserResolver,
  getAsyncNodeResolver,
  getBrowserResolver,
  getNodeResolver,
} from '../resolver-factory';
import { createTaggedLogger } from '../../../../shared/logging/logger';
import { LogTags } from '@mdx-preview/contracts';
import { createSingleton } from '../../../../shared/utils/singleton-factory';
import {
  ResolutionStrategy,
  type ResolutionContext,
  type ResolutionResult,
  type ResolutionMode,
} from '../../types/module-system';
import type { IResolutionStrategy } from '../../types/resolver/strategies';
import {
  buildIgnoredResolutionResult,
  buildResolutionResult,
} from '../resolution-builders';

// module-level tagged logger for enhanced-resolve strategy
const log = createTaggedLogger(LogTags.ENHANCED_RESOLVE);

// enhanced-resolve strategy for node_modules resolution
export class EnhancedResolveStrategy implements IResolutionStrategy {
  readonly name = 'EnhancedResolve';

  private buildResult(
    resolved: string | false,
    specifier: string
  ): ResolutionResult | null {
    if (resolved === false) {
      log.debug(`${specifier} -> ignored by browser field`);
      return buildIgnoredResolutionResult(
        specifier,
        ResolutionStrategy.EnhancedResolve
      );
    }
    if (typeof resolved === 'string') {
      log.debug(`${specifier} -> ${resolved}`);
      return buildResolutionResult(
        resolved,
        specifier,
        ResolutionStrategy.EnhancedResolve
      );
    }
    return null;
  }

  resolve(
    specifier: string,
    context: ResolutionContext,
    mode: ResolutionMode
  ): ResolutionResult | null {
    // fetch per call so resolver-factory singleton resets take effect
    const resolver = mode === 'node' ? getNodeResolver() : getBrowserResolver();

    try {
      const resolved = resolver.resolveSync({}, context.baseDir, specifier);
      return this.buildResult(resolved, specifier);
    } catch {
      // module not found - continue to next strategy
    }

    return null;
  }

  async resolveAsync(
    specifier: string,
    context: ResolutionContext,
    mode: ResolutionMode
  ): Promise<ResolutionResult | null> {
    const resolver =
      mode === 'node' ? getAsyncNodeResolver() : getAsyncBrowserResolver();

    try {
      const resolved = await resolver.resolvePromise(
        {},
        context.baseDir,
        specifier
      );
      return this.buildResult(resolved, specifier);
    } catch {
      return null;
    }
  }
}

// singleton instance
const { get: getEnhancedResolveStrategy } = createSingleton(
  () => new EnhancedResolveStrategy()
);

export { getEnhancedResolveStrategy };
