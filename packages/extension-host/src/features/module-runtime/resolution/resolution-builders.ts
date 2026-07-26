// packages/extension-host/src/features/module-runtime/resolution/resolution-builders.ts
// builder functions for constructing ResolutionResult objects consistently

import {
  ResolutionStrategy,
  type ResolutionResult,
} from '../types/module-system';

export interface IgnoredResolutionResult extends ResolutionResult {
  kind: 'ignored';
}

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

// build a virtual result for modules disabled by package browser mappings
export function buildIgnoredResolutionResult(
  specifier: string,
  strategy: ResolutionStrategy
): IgnoredResolutionResult {
  return {
    fsPath: `/externalModules/${specifier}`,
    isBuiltInShim: false,
    specifier,
    strategy,
    kind: 'ignored',
  };
}

// identify ignored results before callers touch their virtual filesystem path
export function isIgnoredResolution(
  result: ResolutionResult
): result is IgnoredResolutionResult {
  return 'kind' in result && result.kind === 'ignored';
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
