// packages/extension-host/src/features/module-runtime/resolution/strategies/TypeScriptPathStrategy.ts
// TypeScript path alias resolution using compiled pattern index for O(1) exact matches

import * as path from 'path';
import { createTaggedLogger } from '../../../../shared/logging/logger';
import { LogTags } from '@mdx-preview/contracts';
import { createSingleton } from '../../../../shared/utils/singleton-factory';
import { normalizePathSeparators } from '../../../../shared/utils/path-utils';
import {
  ResolutionStrategy,
  type ResolutionContext,
  type ResolutionResult,
  type ResolutionMode,
  type IResolutionStrategy,
} from '../../../types';
import { buildResolutionResult } from '../resolution-builders';
import {
  clearStatCache as clearSharedStatCache,
  probeTypeScriptFile,
  probeTypeScriptFileAsync,
} from '../file-prober';

// module-level tagged logger for TypeScript path resolution
const log = createTaggedLogger(LogTags.TYPESCRIPT);

// compiled pattern index (compile once per tsconfig, O(1) exact matches, O(m) wildcards)

interface CompiledPathPattern {
  originalPattern: string;
  targets: string[];
  isWildcard: boolean;
  // pattern w/o '/*' suffix
  prefix: string;
  // prefix w/ slash
  prefixWithSlash: string;
}

interface CompiledPathsIndex {
  // O(1) exact match lookup
  exactMatches: Map<string, string[]>;
  // wildcards sorted by prefix length
  wildcardPatterns: CompiledPathPattern[];
  // absolute base URL
  absoluteBaseUrl: string;
  // cache key
  cacheKey: string;
}

// per-tsconfig compiled index cache
const compiledIndexCache = new Map<string, CompiledPathsIndex>();

// clear all caches (stat cache & compiled pattern index)
// call on extension deactivation
export function clearStatCache(): void {
  clearSharedStatCache();
  compiledIndexCache.clear();
}

// clear only the compiled pattern index cache
// call when tsconfig.json changes
export function clearCompiledIndexCache(): void {
  compiledIndexCache.clear();
}

// compile tsconfig paths into an indexed data structure
function compilePathsIndex(
  paths: Record<string, string[]>,
  absoluteBaseUrl: string
): CompiledPathsIndex {
  const exactMatches = new Map<string, string[]>();
  const wildcardPatterns: CompiledPathPattern[] = [];

  for (const [pattern, targets] of Object.entries(paths)) {
    if (pattern.endsWith('/*')) {
      // wildcard pattern: pre-compute prefix for matching
      const prefix = pattern.slice(0, -2);
      wildcardPatterns.push({
        originalPattern: pattern,
        targets,
        isWildcard: true,
        prefix,
        prefixWithSlash: prefix + '/',
      });
    } else {
      // exact pattern: pre-resolve target paths
      exactMatches.set(
        pattern,
        targets.map((t) =>
          normalizePathSeparators(path.join(absoluteBaseUrl, t))
        )
      );
    }
  }

  // sort wildcard patterns by prefix length descending (most specific first)
  // ensure @components/icons/* matches before @components/*
  wildcardPatterns.sort((a, b) => b.prefix.length - a.prefix.length);

  return {
    exactMatches,
    wildcardPatterns,
    absoluteBaseUrl,
    cacheKey: JSON.stringify(paths),
  };
}

// get or create compiled index for a tsconfig
function getCompiledIndex(
  paths: Record<string, string[]>,
  absoluteBaseUrl: string,
  configPath: string | undefined
): CompiledPathsIndex {
  // use configPath as primary cache key (stable across calls)
  const cacheKey = configPath ?? absoluteBaseUrl;

  const cached = compiledIndexCache.get(cacheKey);
  if (cached) {
    // validate cache is still valid (paths haven't changed)
    const currentHash = JSON.stringify(paths);
    if (cached.cacheKey === currentHash) {
      return cached;
    }
  }

  // compile & cache
  const compiled = compilePathsIndex(paths, absoluteBaseUrl);
  compiledIndexCache.set(cacheKey, compiled);
  return compiled;
}

// compute the absolute base URL from tsconfig location
// extracted helper to DRY up duplicated code in sync/async methods
function computeAbsoluteBaseUrl(
  tsConfigPath: string | undefined,
  tsConfigBaseUrl: string | undefined,
  contextBaseDir: string
): string {
  const configDir = tsConfigPath ? path.dirname(tsConfigPath) : contextBaseDir;
  const baseUrl = tsConfigBaseUrl ?? '.';
  const absolutePath = path.isAbsolute(baseUrl)
    ? baseUrl
    : path.join(configDir, baseUrl);
  return normalizePathSeparators(absolutePath);
}

// optimized pattern matching using compiled index
// O(1) for exact matches, O(m) for wildcard matches (m = number of wildcards)
function matchTsPathsOptimized(
  specifier: string,
  index: CompiledPathsIndex
): string[] | null {
  // O(1): check exact matches first
  const exactMatch = index.exactMatches.get(specifier);
  if (exactMatch) {
    return exactMatch;
  }

  // O(m): check wildcard patterns (sorted by specificity)
  for (const pattern of index.wildcardPatterns) {
    if (
      specifier.startsWith(pattern.prefixWithSlash) ||
      specifier === pattern.prefix
    ) {
      const suffix =
        specifier === pattern.prefix
          ? ''
          : specifier.slice(pattern.prefix.length + 1);

      return pattern.targets.map((target) => {
        const targetPath = target.endsWith('/*') ? target.slice(0, -2) : target;
        return normalizePathSeparators(
          path.join(index.absoluteBaseUrl, targetPath, suffix)
        );
      });
    }
  }

  return null;
}

// result of candidate resolution setup
export interface CandidateResolutionSetup {
  candidates: string[];
  absoluteBaseUrl: string;
}

// get resolution candidates from tsconfig paths
// extracted to share between sync & async methods
export function getResolutionCandidates(
  specifier: string,
  context: ResolutionContext
): CandidateResolutionSetup | null {
  const tsConfig = context.tsConfig;
  if (!tsConfig?.paths) {
    return null;
  }

  const absoluteBaseUrl = computeAbsoluteBaseUrl(
    tsConfig.configPath,
    tsConfig.baseUrl,
    context.baseDir
  );

  const compiledIndex = getCompiledIndex(
    tsConfig.paths,
    absoluteBaseUrl,
    tsConfig.configPath
  );

  const candidates = matchTsPathsOptimized(specifier, compiledIndex);
  if (!candidates) {
    return null;
  }

  return { candidates, absoluteBaseUrl };
}

// process probed candidate & build result if valid
// return undefined to continue iterating, or ResolutionResult to stop
function processCandidate(
  resolved: string | null,
  specifier: string
): ResolutionResult | undefined {
  if (!resolved) {
    return undefined;
  }

  const normalizedResolved = normalizePathSeparators(resolved);
  // skip .d.ts files
  if (normalizedResolved.endsWith('.d.ts')) {
    return undefined;
  }
  log.debug(`${specifier} -> ${normalizedResolved}`);
  return buildResolutionResult(
    normalizedResolved,
    specifier,
    ResolutionStrategy.TypeScript
  );
}

// TypeScript path resolution strategy (tsconfig.json paths)
// use custom pattern matching instead of TypeScript compiler for performance
// patterns compiled once per tsconfig & cached
export class TypeScriptPathStrategy implements IResolutionStrategy {
  readonly name = 'TypeScript';

  resolve(
    specifier: string,
    context: ResolutionContext,
    _mode: ResolutionMode
  ): ResolutionResult | null {
    const setup = getResolutionCandidates(specifier, context);
    if (!setup) {
      return null;
    }

    // try each candidate path using shared file prober
    for (const candidate of setup.candidates) {
      const result = processCandidate(
        probeTypeScriptFile(candidate),
        specifier
      );
      if (result) {
        return result;
      }
    }

    return null;
  }

  async resolveAsync(
    specifier: string,
    context: ResolutionContext,
    _mode: ResolutionMode
  ): Promise<ResolutionResult | null> {
    const setup = getResolutionCandidates(specifier, context);
    if (!setup) {
      return null;
    }

    // try each candidate path w/ async probing
    for (const candidate of setup.candidates) {
      const result = processCandidate(
        await probeTypeScriptFileAsync(candidate),
        specifier
      );
      if (result) {
        return result;
      }
    }

    return null;
  }
}

// singleton instance
const { get: getTypeScriptPathStrategy } = createSingleton(
  () => new TypeScriptPathStrategy()
);

export { getTypeScriptPathStrategy };
