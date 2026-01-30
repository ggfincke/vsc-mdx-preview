// packages/extension/module-system/resolver/strategies/TypeScriptPathStrategy.ts
// TypeScript path alias resolution using compiled pattern index for O(1) exact matches

import * as path from 'path';
import { debug } from '../../../logging';
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
  prefix: string; // pattern without '/*' suffix
  prefixWithSlash: string; // prefix + '/' for startsWith check
}

interface CompiledPathsIndex {
  // O(1) lookup for exact matches (e.g., "@utils" -> ["/project/src/utils"])
  exactMatches: Map<string, string[]>;
  // Wildcard patterns sorted by prefix length (longest first for specificity)
  wildcardPatterns: CompiledPathPattern[];
  // The absolute base URL for path resolution
  absoluteBaseUrl: string;
  // Cache key for invalidation (stringified paths)
  cacheKey: string;
}

// Per-tsconfig compiled index cache
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

// Compile tsconfig paths into an indexed data structure
function compilePathsIndex(
  paths: Record<string, string[]>,
  absoluteBaseUrl: string
): CompiledPathsIndex {
  const exactMatches = new Map<string, string[]>();
  const wildcardPatterns: CompiledPathPattern[] = [];

  for (const [pattern, targets] of Object.entries(paths)) {
    if (pattern.endsWith('/*')) {
      // Wildcard pattern: pre-compute prefix for matching
      const prefix = pattern.slice(0, -2);
      wildcardPatterns.push({
        originalPattern: pattern,
        targets,
        isWildcard: true,
        prefix,
        prefixWithSlash: prefix + '/',
      });
    } else {
      // Exact pattern: pre-resolve target paths
      exactMatches.set(
        pattern,
        targets.map((t) => path.join(absoluteBaseUrl, t))
      );
    }
  }

  // Sort wildcard patterns by prefix length descending (most specific first)
  // This ensures @components/icons/* matches before @components/*
  wildcardPatterns.sort((a, b) => b.prefix.length - a.prefix.length);

  return {
    exactMatches,
    wildcardPatterns,
    absoluteBaseUrl,
    cacheKey: JSON.stringify(paths),
  };
}

// Get or create compiled index for a tsconfig
function getCompiledIndex(
  paths: Record<string, string[]>,
  absoluteBaseUrl: string,
  configPath: string | undefined
): CompiledPathsIndex {
  // Use configPath as primary cache key (stable across calls)
  const cacheKey = configPath ?? absoluteBaseUrl;

  const cached = compiledIndexCache.get(cacheKey);
  if (cached) {
    // Validate cache is still valid (paths haven't changed)
    const currentHash = JSON.stringify(paths);
    if (cached.cacheKey === currentHash) {
      return cached;
    }
  }

  // Compile and cache
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

// Optimized pattern matching using compiled index
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
    const tsConfig = context.tsConfig;
    if (!tsConfig?.paths) {
      return null;
    }

    // Compute absolute baseUrl using shared helper
    const absoluteBaseUrl = computeAbsoluteBaseUrl(
      tsConfig.configPath,
      tsConfig.baseUrl,
      context.baseDir
    );

    // Get compiled pattern index (cached per tsconfig)
    const compiledIndex = getCompiledIndex(
      tsConfig.paths,
      absoluteBaseUrl,
      tsConfig.configPath
    );

    // Use optimized pattern matching (O(1) exact, O(m) wildcard)
    const candidates = matchTsPathsOptimized(specifier, compiledIndex);
    if (!candidates) {
      return null;
    }

    // Try each candidate path using shared file prober
    for (const candidate of candidates) {
      const resolved = probeTypeScriptFile(candidate);
      if (resolved) {
        // Skip .d.ts files
        if (resolved.endsWith('.d.ts')) {
          continue;
        }
        debug(`[TYPESCRIPT] ${specifier} -> ${resolved}`);
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
    const tsConfig = context.tsConfig;
    if (!tsConfig?.paths) {
      return null;
    }

    // Compute absolute baseUrl using shared helper
    const absoluteBaseUrl = computeAbsoluteBaseUrl(
      tsConfig.configPath,
      tsConfig.baseUrl,
      context.baseDir
    );

    // Get compiled pattern index (cached per tsconfig)
    const compiledIndex = getCompiledIndex(
      tsConfig.paths,
      absoluteBaseUrl,
      tsConfig.configPath
    );

    // Use optimized pattern matching
    const candidates = matchTsPathsOptimized(specifier, compiledIndex);
    if (!candidates) {
      return null;
    }

    // try each candidate path w/ async probing
    for (const candidate of candidates) {
      const resolved = await probeTypeScriptFileAsync(candidate);
      if (resolved) {
        // Skip .d.ts files
        if (resolved.endsWith('.d.ts')) {
          continue;
        }
        debug(`[TYPESCRIPT] ${specifier} -> ${resolved}`);
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

// Singleton instance
const { get: getTypeScriptPathStrategy } = createSingleton(
  () => new TypeScriptPathStrategy()
);

export { getTypeScriptPathStrategy };
