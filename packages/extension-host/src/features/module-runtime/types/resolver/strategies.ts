// packages/extension/types/resolver/strategies.ts
// type definitions for resolution strategies

import type {
  ResolutionContext,
  ResolutionResult,
  ResolutionMode,
} from '../module-system';

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

  // optional async resolution for parallel file probing
  resolveAsync?(
    specifier: string,
    context: ResolutionContext,
    mode: ResolutionMode
  ): Promise<ResolutionResult | null>;
}
