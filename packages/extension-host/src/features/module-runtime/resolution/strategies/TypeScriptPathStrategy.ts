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
} from '../../types/module-system';
import type { IResolutionStrategy } from '../../types/resolver/strategies';
import { buildResolutionResult } from '../resolution-builders';
import { probeTypeScriptFile, probeTypeScriptFileAsync } from '../file-prober';

// module-level tagged logger for TypeScript path resolution
const log = createTaggedLogger(LogTags.TYPESCRIPT);

// compiled pattern index (compile once per tsconfig, O(1) exact matches, O(m) wildcards)

interface CompiledPathPattern {
  targets: string[];
  // pattern text before the star
  prefix: string;
  // pattern text after the star
  suffix: string;
}

interface CompiledPathsIndex {
  // O(1) exact match lookup
  exactMatches: Map<string, string[]>;
  // wildcards sorted by prefix length
  wildcardPatterns: CompiledPathPattern[];
  // absolute base URL
  absoluteBaseUrl: string;
  // serialized base URL + paths identity
  cacheIdentity: string;
  // source paths object for identity fast path
  sourcePaths: Record<string, string[]>;
}

// per-tsconfig compiled index cache
const compiledIndexCache = new Map<string, CompiledPathsIndex>();

// clear only the compiled pattern index cache
// call when tsconfig.json changes
export function clearCompiledIndexCache(): void {
  compiledIndexCache.clear();
}

// internal/test seam: observe compiled index cache size for invalidation checks
export function getCompiledIndexCacheSize(): number {
  return compiledIndexCache.size;
}

// include the normalized base URL in the compiled representation identity
function createCacheIdentity(
  paths: Record<string, string[]>,
  absoluteBaseUrl: string
): string {
  return JSON.stringify([absoluteBaseUrl, paths]);
}

// compile tsconfig paths into an indexed data structure
function compilePathsIndex(
  paths: Record<string, string[]>,
  absoluteBaseUrl: string
): CompiledPathsIndex {
  const exactMatches = new Map<string, string[]>();
  const wildcardPatterns: CompiledPathPattern[] = [];

  for (const [pattern, targets] of Object.entries(paths)) {
    const starIndex = pattern.indexOf('*');
    if (starIndex !== -1 && starIndex === pattern.lastIndexOf('*')) {
      wildcardPatterns.push({
        targets,
        prefix: pattern.slice(0, starIndex),
        suffix: pattern.slice(starIndex + 1),
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
    cacheIdentity: createCacheIdentity(paths, absoluteBaseUrl),
    sourcePaths: paths,
  };
}

// get or create compiled index for a tsconfig
function getCompiledIndex(
  paths: Record<string, string[]>,
  absoluteBaseUrl: string,
  configPath: string | undefined
): CompiledPathsIndex {
  const normalizedConfigPath = configPath
    ? normalizePathSeparators(path.normalize(configPath))
    : null;
  const cacheKey = JSON.stringify([normalizedConfigPath, absoluteBaseUrl]);

  const cached = compiledIndexCache.get(cacheKey);
  if (cached) {
    // object identity is safe only when the normalized base URL also matches
    if (
      cached.sourcePaths === paths &&
      cached.absoluteBaseUrl === absoluteBaseUrl
    ) {
      return cached;
    }
    const currentIdentity = createCacheIdentity(paths, absoluteBaseUrl);
    if (cached.cacheIdentity === currentIdentity) {
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
  return normalizePathSeparators(path.normalize(absolutePath));
}

// substitute the captured text at a target's optional single star
function resolveTarget(
  target: string,
  captured: string,
  absoluteBaseUrl: string
): string {
  const starIndex = target.indexOf('*');
  const substituted =
    starIndex === -1
      ? target
      : `${target.slice(0, starIndex)}${captured}${target.slice(starIndex + 1)}`;
  return normalizePathSeparators(path.join(absoluteBaseUrl, substituted));
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
      !specifier.startsWith(pattern.prefix) ||
      !specifier.endsWith(pattern.suffix) ||
      specifier.length < pattern.prefix.length + pattern.suffix.length
    ) {
      continue;
    }

    const captureEnd = specifier.length - pattern.suffix.length;
    const captured = specifier.slice(pattern.prefix.length, captureEnd);
    return pattern.targets.map((target) =>
      resolveTarget(target, captured, index.absoluteBaseUrl)
    );
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
