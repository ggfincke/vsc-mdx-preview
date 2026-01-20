// packages/extension/module-system/resolver/strategies/EnhancedResolveStrategy.ts
// Node.js-style resolution using enhanced-resolve

import type { Resolver } from 'enhanced-resolve';
import { getBrowserResolver, getNodeResolver } from '../resolver-factory';
import { debug } from '../../../logging';
import { createSingleton } from '../../../utils/singleton-factory';
import {
  ResolutionStrategy,
  type ResolutionContext,
  type ResolutionResult,
  type ResolutionMode,
} from '../../types';
import type { IResolutionStrategy } from './types';
import { buildResolutionResult } from '../result-builders';

// enhanced-resolve strategy for node_modules resolution
export class EnhancedResolveStrategy implements IResolutionStrategy {
  readonly name = 'EnhancedResolve';

  private browserResolver: Resolver;
  private nodeResolver: Resolver;

  constructor() {
    this.browserResolver = getBrowserResolver();
    this.nodeResolver = getNodeResolver();
  }

  resolve(
    specifier: string,
    context: ResolutionContext,
    mode: ResolutionMode
  ): ResolutionResult | null {
    const resolver = mode === 'node' ? this.nodeResolver : this.browserResolver;

    try {
      const resolved = resolver.resolveSync({}, context.baseDir, specifier);
      if (resolved) {
        debug(`[ENHANCED-RESOLVE] ${specifier} -> ${resolved}`);
        return buildResolutionResult(resolved, specifier, ResolutionStrategy.EnhancedResolve);
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

