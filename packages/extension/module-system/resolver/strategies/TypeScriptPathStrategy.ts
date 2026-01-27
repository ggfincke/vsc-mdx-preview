// packages/extension/module-system/resolver/strategies/TypeScriptPathStrategy.ts
// typescript path alias resolution strategy using custom pattern matching

import * as path from 'path';
import * as fs from 'fs';
import { debug } from '../../../logging';
import { createSingleton } from '../../../utils/singleton-factory';
import {
  ResolutionStrategy,
  type ResolutionContext,
  type ResolutionResult,
  type ResolutionMode,
} from '../../types';
import type { IResolutionStrategy } from './types';
import { buildResolutionResult } from '../result-builders';

// file extensions to probe when resolving paths
const PROBE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json', ''];
const INDEX_FILES = [
  'index.ts',
  'index.tsx',
  'index.js',
  'index.jsx',
  'index.mjs',
];

// ============================================================================
// Bounded LRU stat cache for file probing (reduces fs.statSync calls)
// Uses Map insertion order for O(1) LRU eviction
// ============================================================================

interface StatCacheEntry {
  exists: boolean;
  isFile: boolean;
  isDirectory: boolean;
  timestamp: number;
}

const STAT_CACHE_TTL_MS = 5000; // 5 seconds
const STAT_CACHE_MAX_ENTRIES = 1000;

class BoundedStatCache {
  private cache = new Map<string, StatCacheEntry>();

  get(filePath: string): StatCacheEntry | null {
    const entry = this.cache.get(filePath);
    if (!entry) {
      return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp >= STAT_CACHE_TTL_MS) {
      this.cache.delete(filePath);
      return null;
    }

    // Move to end for LRU (delete + re-insert)
    this.cache.delete(filePath);
    this.cache.set(filePath, entry);
    return entry;
  }

  set(filePath: string, stat: fs.Stats | null): StatCacheEntry {
    const entry: StatCacheEntry = {
      exists: stat !== null,
      isFile: stat?.isFile() ?? false,
      isDirectory: stat?.isDirectory() ?? false,
      timestamp: Date.now(),
    };

    // Remove existing entry first (for LRU reordering)
    this.cache.delete(filePath);

    // Evict oldest if at capacity (first entry is LRU due to Map order)
    while (this.cache.size >= STAT_CACHE_MAX_ENTRIES) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey === undefined) {
        break;
      }
      this.cache.delete(oldestKey);
    }

    this.cache.set(filePath, entry);
    return entry;
  }

  clear(): void {
    this.cache.clear();
  }
}

const statCache = new BoundedStatCache();

// Export for extension deactivation cleanup
export function clearStatCache(): void {
  statCache.clear();
  // I.2: also clear compiled pattern index cache
  compiledIndexCache.clear();
}

function getCachedStat(filePath: string): StatCacheEntry | null {
  return statCache.get(filePath);
}

function setCachedStat(
  filePath: string,
  stat: fs.Stats | null
): StatCacheEntry {
  return statCache.set(filePath, stat);
}

function getOrCreateStat(filePath: string): StatCacheEntry {
  const cached = getCachedStat(filePath);
  if (cached) {
    return cached;
  }

  try {
    const stat = fs.statSync(filePath);
    return setCachedStat(filePath, stat);
  } catch {
    return setCachedStat(filePath, null);
  }
}

// ============================================================================
// I.2: Compiled pattern index for O(1) exact matches and O(m) wildcard matches
// Patterns are compiled once per tsconfig and cached for subsequent lookups
// ============================================================================

interface CompiledPathPattern {
  originalPattern: string;
  targets: string[];
  isWildcard: boolean;
  prefix: string;           // pattern without '/*' suffix
  prefixWithSlash: string;  // prefix + '/' for startsWith check
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

// per-tsconfig compiled index cache
const compiledIndexCache = new Map<string, CompiledPathsIndex>();

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
  // this ensures @components/icons/* matches before @components/*
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

  // compile and cache
  const compiled = compilePathsIndex(paths, absoluteBaseUrl);
  compiledIndexCache.set(cacheKey, compiled);
  return compiled;
}

// I.2: optimized pattern matching using compiled index
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

// probe for file existence w/ various extensions (uses stat cache)
function probeFile(basePath: string): string | null {
  // try exact path first w/ various extensions
  for (const ext of PROBE_EXTENSIONS) {
    const fullPath = basePath + ext;
    const stat = getOrCreateStat(fullPath);
    if (stat.exists && stat.isFile) {
      return fullPath;
    }
  }

  // try as directory with index file
  const baseStat = getOrCreateStat(basePath);
  if (baseStat.exists && baseStat.isDirectory) {
    for (const indexFile of INDEX_FILES) {
      const indexPath = path.join(basePath, indexFile);
      const indexStat = getOrCreateStat(indexPath);
      if (indexStat.exists && indexStat.isFile) {
        return indexPath;
      }
    }
  }

  return null;
}

// ============================================================================
// I.3: Async batch stat utility for parallel file probing
// Batches all stat calls in parallel while preserving priority order
// ============================================================================

// batch stat multiple paths in parallel (uses cache for cached paths)
async function batchStatAsync(
  paths: string[]
): Promise<Map<string, StatCacheEntry>> {
  const results = new Map<string, StatCacheEntry>();
  const uncachedPaths: string[] = [];

  // separate cached from uncached
  for (const p of paths) {
    const cached = getCachedStat(p);
    if (cached) {
      results.set(p, cached);
    } else {
      uncachedPaths.push(p);
    }
  }

  // parallel stat for uncached paths
  if (uncachedPaths.length > 0) {
    const statResults = await Promise.all(
      uncachedPaths.map(async (p) => {
        try {
          const stat = await fs.promises.stat(p);
          return { path: p, entry: setCachedStat(p, stat) };
        } catch {
          return { path: p, entry: setCachedStat(p, null) };
        }
      })
    );

    for (const { path: p, entry } of statResults) {
      results.set(p, entry);
    }
  }

  return results;
}

// I.3: async version of probeFile with parallel stat calls
async function probeFileAsync(basePath: string): Promise<string | null> {
  // generate all candidate paths for extensions
  const extensionPaths = PROBE_EXTENSIONS.map((ext) => basePath + ext);

  // batch stat all extension candidates in parallel
  const extensionResults = await batchStatAsync(extensionPaths);

  // check in priority order (.ts before .tsx before .js, etc.)
  for (const ext of PROBE_EXTENSIONS) {
    const fullPath = basePath + ext;
    const result = extensionResults.get(fullPath);
    if (result?.exists && result.isFile) {
      return fullPath;
    }
  }

  // check if base is directory ('' extension gives us basePath)
  const baseResult = extensionResults.get(basePath);
  if (baseResult?.exists && baseResult.isDirectory) {
    // batch stat index files
    const indexPaths = INDEX_FILES.map((idx) => path.join(basePath, idx));
    const indexResults = await batchStatAsync(indexPaths);

    // check in priority order
    for (const indexFile of INDEX_FILES) {
      const indexPath = path.join(basePath, indexFile);
      const result = indexResults.get(indexPath);
      if (result?.exists && result.isFile) {
        return indexPath;
      }
    }
  }

  return null;
}

// typescript path resolution strategy (tsconfig.json paths)
// uses custom pattern matching instead of TypeScript compiler
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

    // compute absolute baseUrl from tsconfig location
    // default baseUrl to '.' if not specified
    const configDir = tsConfig.configPath
      ? path.dirname(tsConfig.configPath)
      : context.baseDir;
    const baseUrl = tsConfig.baseUrl ?? '.';
    const absoluteBaseUrl = path.isAbsolute(baseUrl)
      ? baseUrl
      : path.join(configDir, baseUrl);

    // I.2: get compiled pattern index (cached per tsconfig)
    const compiledIndex = getCompiledIndex(
      tsConfig.paths,
      absoluteBaseUrl,
      tsConfig.configPath
    );

    // I.2: use optimized pattern matching (O(1) exact, O(m) wildcard)
    const candidates = matchTsPathsOptimized(specifier, compiledIndex);
    if (!candidates) {
      return null;
    }

    // try each candidate path
    for (const candidate of candidates) {
      const resolved = probeFile(candidate);
      if (resolved) {
        // skip .d.ts files
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

  // I.3: async resolution with parallel file probing
  async resolveAsync(
    specifier: string,
    context: ResolutionContext,
    _mode: ResolutionMode
  ): Promise<ResolutionResult | null> {
    const tsConfig = context.tsConfig;
    if (!tsConfig?.paths) {
      return null;
    }

    // compute absolute baseUrl from tsconfig location
    const configDir = tsConfig.configPath
      ? path.dirname(tsConfig.configPath)
      : context.baseDir;
    const baseUrl = tsConfig.baseUrl ?? '.';
    const absoluteBaseUrl = path.isAbsolute(baseUrl)
      ? baseUrl
      : path.join(configDir, baseUrl);

    // I.2: get compiled pattern index (cached per tsconfig)
    const compiledIndex = getCompiledIndex(
      tsConfig.paths,
      absoluteBaseUrl,
      tsConfig.configPath
    );

    // I.2: use optimized pattern matching
    const candidates = matchTsPathsOptimized(specifier, compiledIndex);
    if (!candidates) {
      return null;
    }

    // I.3: try each candidate path with async probing
    for (const candidate of candidates) {
      const resolved = await probeFileAsync(candidate);
      if (resolved) {
        // skip .d.ts files
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

// singleton instance
const { get: getTypeScriptPathStrategy } = createSingleton(
  () => new TypeScriptPathStrategy()
);

export { getTypeScriptPathStrategy };
