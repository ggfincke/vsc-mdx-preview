// packages/extension/module-system/resolver/strategies/types.ts
// Strategy interface for modular resolution approaches

import type {
  ResolutionContext,
  ResolutionResult,
  ResolutionMode,
} from '../../types';

/**
 * Interface for resolution strategies.
 * Each strategy handles a specific type of import resolution.
 */
export interface IResolutionStrategy {
  /** Strategy name for debugging/logging */
  readonly name: string;

  /**
   * Resolve a module specifier to a filesystem path.
   * @param specifier - The import specifier (e.g., './Button', '@/utils')
   * @param context - Resolution context including baseDir, tsConfig, etc.
   * @param mode - Resolution mode ('browser' | 'node' | 'dependency')
   * @returns Resolution result or null if this strategy cannot resolve
   */
  resolve(
    specifier: string,
    context: ResolutionContext,
    mode: ResolutionMode
  ): ResolutionResult | null;
}
