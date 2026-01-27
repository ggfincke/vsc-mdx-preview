// packages/extension/module-system/resolver/strategies/types.ts
// strategy interface for modular resolution approaches

import type {
  ResolutionContext,
  ResolutionResult,
  ResolutionMode,
} from '../../types';

// interface for resolution strategies
export interface IResolutionStrategy {
  // strategy name for debugging/logging
  readonly name: string;

  // resolve a module specifier to a filesystem path
  resolve(
    specifier: string,
    context: ResolutionContext,
    mode: ResolutionMode
  ): ResolutionResult | null;

  // I.3: optional async resolution for parallel file probing
  resolveAsync?(
    specifier: string,
    context: ResolutionContext,
    mode: ResolutionMode
  ): Promise<ResolutionResult | null>;
}
