// packages/extension/module-system/resolver/result-builders.ts
// builder functions for constructing ResolutionResult objects consistently

import type { ResolutionResult } from '../types';
import { ResolutionStrategy } from '../types';

// build a standard ResolutionResult for non-shim modules
export function buildResolutionResult(
  fsPath: string,
  specifier: string,
  strategy: ResolutionStrategy
): ResolutionResult {
  return {
    fsPath,
    isBuiltInShim: false,
    specifier,
    strategy,
  };
}

// build a ResolutionResult for built-in shim modules
export function buildShimResolutionResult(
  fsPath: string,
  specifier: string,
  strategy: ResolutionStrategy
): ResolutionResult {
  return {
    fsPath,
    isBuiltInShim: true,
    specifier,
    strategy,
  };
}
