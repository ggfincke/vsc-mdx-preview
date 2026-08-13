// packages/extension-host/src/features/module-runtime/resolution/local-resolution-policy.ts
// identify canonical local files eligible for dependency consumers

import {
  isBareImport,
  isNpmModuleId,
  isValidModuleRequest,
} from '@mdx-preview/runtime-utils';
import { isPathWithin } from '../../../shared/utils/path-utils';
import {
  ResolutionStrategy,
  type ResolutionResult,
} from '../types/module-system';
import { isNodeModulesPath } from './file-prober';
import { isIgnoredResolution } from './resolution-builders';

interface LocalResolutionPolicyOptions {
  allowBareWorkspacePackages?: boolean;
}

// return the canonical path only when the resolution targets a local file
export function getEligibleLocalResolutionPath(
  request: unknown,
  result: ResolutionResult | null,
  workspaceRoot: string | undefined,
  canonicalPath: string | null,
  canonicalWorkspaceRoot: string | null,
  options: LocalResolutionPolicyOptions = {}
): string | null {
  if (
    typeof request !== 'string' ||
    request.length === 0 ||
    !isValidModuleRequest(request) ||
    isNpmModuleId(request) ||
    request.startsWith('node:') ||
    !result ||
    result.isBuiltInShim ||
    isIgnoredResolution(result) ||
    !canonicalPath
  ) {
    return null;
  }

  if (isNodeModulesPath(result.fsPath) || isNodeModulesPath(canonicalPath)) {
    return null;
  }

  const isBareEnhancedResolution =
    result.strategy === ResolutionStrategy.EnhancedResolve &&
    isBareImport(result.specifier);
  const isLocalStrategy =
    result.strategy === ResolutionStrategy.FileProbe ||
    result.strategy === ResolutionStrategy.TypeScript ||
    result.strategy === ResolutionStrategy.EnhancedResolve;
  if (
    !isLocalStrategy ||
    (isBareEnhancedResolution &&
      (!options.allowBareWorkspacePackages ||
        !workspaceRoot ||
        !canonicalWorkspaceRoot))
  ) {
    return null;
  }

  if (
    workspaceRoot &&
    (!canonicalWorkspaceRoot ||
      !isPathWithin(result.fsPath, workspaceRoot) ||
      !isPathWithin(canonicalPath, canonicalWorkspaceRoot))
  ) {
    return null;
  }

  return canonicalPath;
}
