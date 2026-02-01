// packages/extension/module-system/resolver/strategies/TypeScriptPathStrategy.ts
// TypeScript path alias resolution using compiled pattern index for O(1) exact matches

import * as path from 'path';
import { debug } from '../../../logging';
import { LogTags } from '@mdx-preview/shared';
import { createSingleton } from '../../../utils/singleton-factory';
import {
  ResolutionStrategy,
  type ResolutionContext,
  type ResolutionResult,
  type ResolutionMode,
  type IResolutionStrategy,
} from '../../../types';
import { buildResolutionResult } from '../result-builders';
import {
  clearStatCache as clearSharedStatCache,
  probeTypeScriptFile,
  probeTypeScriptFileAsync,
} from '../file-prober';

// compiled pattern index (compile once per tsconfig, O(1) exact matches, O(m) wildcards)

interface CompiledPathPattern {
  originalPattern: string;
  targets: string[];
  isWildcard: boolean;
  // pattern without '/*' suffix
  prefix: string;
  // prefix + '/' for startsWith check
  prefixWithSlash: string;
}

interface CompiledPathsIndex {
  // O(1) lookup for exact matches (e.g., "@utils" -> ["/project/src/utils"])
  exactMatches: Map<string, string[]>;
  // wildcard patterns sorted by prefix length (longest first for specificity)
  wildcardPatterns: CompiledPathPattern[];
  // absolute base URL for path resolution
  absoluteBaseUrl: string;
  // cache key for invalidation (stringified paths)
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
        targets.map((t) => path.join(absoluteBaseUrl, t))
      );
    }
  }

  // sort wildcard patterns by prefix length descending (most specific first)
  // ensures @components/icons/* matches before @components/*
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
  return path.isAbsolute(baseUrl) ? baseUrl : path.join(configDir, baseUrl);
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
        return path.join(index.absoluteBaseUrl, targetPath, suffix);
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

// TypeScript path resolution strategy (tsconfig.json paths)
// uses custom pattern matching instead of TypeScript compiler for performance
// patterns are compiled once per tsconfig & cached
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
      const resolved = probeTypeScriptFile(candidate);
      if (resolved) {
        // skip .d.ts files
        if (resolved.endsWith('.d.ts')) {
          continue;
        }
        debug(`[${LogTags.TYPESCRIPT}] ${specifier} -> ${resolved}`);
        return buildResolutionResult(
          resolved,
          specifier,
          ResolutionStrategy.TypeScript
        );
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
      const resolved = await probeTypeScriptFileAsync(candidate);
      if (resolved) {
        // skip .d.ts files
        if (resolved.endsWith('.d.ts')) {
          continue;
        }
        debug(`[${LogTags.TYPESCRIPT}] ${specifier} -> ${resolved}`);
        return buildResolutionResult(
          resolved,
          specifier,
          ResolutionStrategy.TypeScript
        );
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
