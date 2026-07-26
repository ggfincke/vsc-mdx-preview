// packages/extension-host/src/features/module-runtime/resolution/strategies/EnhancedResolveStrategy.ts
// node.js-style resolution using enhanced-resolve

import { getBrowserResolver, getNodeResolver } from '../resolver-factory';
import { createTaggedLogger } from '../../../../shared/logging/logger';
import { LogTags } from '@mdx-preview/contracts';
import { createSingleton } from '../../../../shared/utils/singleton-factory';
import {
  ResolutionStrategy,
  type ResolutionContext,
  type ResolutionResult,
  type ResolutionMode,
  type IResolutionStrategy,
} from '../../../types';
import {
  buildIgnoredResolutionResult,
  buildResolutionResult,
} from '../resolution-builders';

// module-level tagged logger for enhanced-resolve strategy
const log = createTaggedLogger(LogTags.ENHANCED_RESOLVE);

// enhanced-resolve strategy for node_modules resolution
export class EnhancedResolveStrategy implements IResolutionStrategy {
  readonly name = 'EnhancedResolve';

  resolve(
    specifier: string,
    context: ResolutionContext,
    mode: ResolutionMode
  ): ResolutionResult | null {
    // fetch per call so resolver-factory singleton resets take effect
    const resolver = mode === 'node' ? getNodeResolver() : getBrowserResolver();

    try {
      const resolved = resolver.resolveSync({}, context.baseDir, specifier);
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
    } catch {
      // module not found - continue to next strategy
    }

    return null;
  }
}

// singleton instance
const { get: getEnhancedResolveStrategy } = createSingleton(
  () => new EnhancedResolveStrategy()
);

export { getEnhancedResolveStrategy };
