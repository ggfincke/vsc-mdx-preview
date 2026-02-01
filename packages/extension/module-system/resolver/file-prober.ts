// packages/extension/module-system/resolver/file-prober.ts
// shared file probing utility for module resolution strategies
// provides sync & async probing w/ stat caching

import * as path from 'path';
import * as fs from 'fs';
import { LRUCache } from '@mdx-preview/shared';
import {
  TYPESCRIPT_RESOLUTION_EXTENSIONS,
  TS_INDEX_FILES,
  FILE_PROBE_EXTENSIONS,
  FILE_PROBE_INDEX_FILES,
} from '../../constants';

// stat cache (LRU w/ TTL for file stat results)

// cached stat result containing file existence & type info
export interface StatResult {
  exists: boolean;
  isFile: boolean;
  isDirectory: boolean;
}

// 5 seconds
const STAT_CACHE_TTL_MS = 5000;
const STAT_CACHE_MAX_ENTRIES = 1000;

// Internal stat cache using LRUCache
const statCache = new LRUCache<string, StatResult>({
  maxEntries: STAT_CACHE_MAX_ENTRIES,
  ttlMs: STAT_CACHE_TTL_MS,
});

// clear the stat cache
// call on extension deactivation or when file system changes require cache invalidation
export function clearStatCache(): void {
  statCache.clear();
}

// get cached stat result for a path
// return null if not cached or expired
export function getCachedStat(filePath: string): StatResult | null {
  return statCache.get(filePath);
}

// set stat result in cache
// convert fs.Stats to StatResult (or create "not exists" result if null)
export function setCachedStat(
  filePath: string,
  stat: fs.Stats | null
): StatResult {
  const result: StatResult = {
    exists: stat !== null,
    isFile: stat?.isFile() ?? false,
    isDirectory: stat?.isDirectory() ?? false,
  };
  statCache.set(filePath, result);
  return result;
}

// get or create stat result for a path (sync)
// uses cache if available, otherwise performs fs.statSync
export function getOrCreateStat(filePath: string): StatResult {
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

// batch stat utilities (parallel file stat for async probing)

// batch stat multiple paths in parallel
// uses cache for already-cached paths, parallel stat for uncached
export async function batchStatAsync(
  paths: string[]
): Promise<Map<string, StatResult>> {
  const results = new Map<string, StatResult>();
  const uncachedPaths: string[] = [];

  // Separate cached from uncached
  for (const p of paths) {
    const cached = getCachedStat(p);
    if (cached) {
      results.set(p, cached);
    } else {
      uncachedPaths.push(p);
    }
  }

  // Parallel stat for uncached paths
  if (uncachedPaths.length > 0) {
    const statResults = await Promise.all(
      uncachedPaths.map(async (p) => {
        try {
          const stat = await fs.promises.stat(p);
          return { path: p, result: setCachedStat(p, stat) };
        } catch {
          return { path: p, result: setCachedStat(p, null) };
        }
      })
    );

    for (const { path: p, result } of statResults) {
      results.set(p, result);
    }
  }

  return results;
}

// file probing (sync & async w/ configurable extensions)

// options for file probing
export interface FileProbingOptions {
  // extensions to try (in priority order)
  extensions: readonly string[];
  // index files to try when path is a directory
  indexFiles: readonly string[];
  // skip paths containing node_modules (default: true)
  skipNodeModules?: boolean;
}

// parsed probing options w/ defaults applied
export interface ParsedProbingOptions {
  extensions: readonly string[];
  indexFiles: readonly string[];
  skipNodeModules: boolean;
}

// default options for file probing (Required to ensure defaults are always present)
export const DEFAULT_PROBING_OPTIONS: Required<FileProbingOptions> = {
  extensions: FILE_PROBE_EXTENSIONS,
  indexFiles: FILE_PROBE_INDEX_FILES,
  skipNodeModules: true,
};

// parse probing options w/ defaults
export function parseProbingOptions(
  options: Partial<FileProbingOptions>
): ParsedProbingOptions {
  return {
    extensions: options.extensions ?? DEFAULT_PROBING_OPTIONS.extensions,
    indexFiles: options.indexFiles ?? DEFAULT_PROBING_OPTIONS.indexFiles,
    skipNodeModules:
      options.skipNodeModules ?? DEFAULT_PROBING_OPTIONS.skipNodeModules,
  };
}

// check if path should be skipped (node_modules guard)
export function shouldSkipPath(
  basePath: string,
  skipNodeModules: boolean
): boolean {
  return skipNodeModules && basePath.includes('node_modules');
}

// find first matching index file from stat results (async batched)
export function findIndexFileInResults(
  basePath: string,
  indexFiles: readonly string[],
  statResults: Map<string, StatResult>
): string | null {
  for (const indexFile of indexFiles) {
    const indexPath = path.join(basePath, indexFile);
    const result = statResults.get(indexPath);
    if (result?.exists && result.isFile) {
      return indexPath;
    }
  }
  return null;
}

// find first matching index file using sync stat
export function findIndexFileSync(
  basePath: string,
  indexFiles: readonly string[]
): string | null {
  for (const indexFile of indexFiles) {
    const indexPath = path.join(basePath, indexFile);
    const stat = getOrCreateStat(indexPath);
    if (stat.exists && stat.isFile) {
      return indexPath;
    }
  }
  return null;
}

// probe for a file w/ various extensions (sync)
// tries the base path w/ each extension in priority order
// then tries index files if the base path is a directory
export function probeFile(
  basePath: string,
  options: Partial<FileProbingOptions> = {}
): string | null {
  const { extensions, indexFiles, skipNodeModules } =
    parseProbingOptions(options);

  if (shouldSkipPath(basePath, skipNodeModules)) {
    return null;
  }

  // try exact path w/ various extensions
  for (const ext of extensions) {
    const fullPath = basePath + ext;
    const stat = getOrCreateStat(fullPath);
    if (stat.exists && stat.isFile) {
      return fullPath;
    }
  }

  // try as directory w/ index file
  const baseStat = getOrCreateStat(basePath);
  if (baseStat.exists && baseStat.isDirectory) {
    return findIndexFileSync(basePath, indexFiles);
  }

  return null;
}

// probe for a file w/ various extensions (async)
// uses parallel stat calls for better performance on initial resolution
// subsequent calls benefit from cache
export async function probeFileAsync(
  basePath: string,
  options: Partial<FileProbingOptions> = {}
): Promise<string | null> {
  const { extensions, indexFiles, skipNodeModules } =
    parseProbingOptions(options);

  if (shouldSkipPath(basePath, skipNodeModules)) {
    return null;
  }

  // Generate all candidate paths for extensions
  const extensionPaths = extensions.map((ext) => basePath + ext);

  // Batch stat all extension candidates in parallel
  const extensionResults = await batchStatAsync(extensionPaths);

  // Check in priority order
  for (const ext of extensions) {
    const fullPath = basePath + ext;
    const result = extensionResults.get(fullPath);
    if (result?.exists && result.isFile) {
      return fullPath;
    }
  }

  // Check if base is a directory (from extension results if '' was included)
  const baseResult = extensionResults.get(basePath);
  const isDirectory = baseResult?.exists && baseResult.isDirectory;

  // If basePath without extension wasn't checked, check it now
  if (!baseResult) {
    const stat = await batchStatAsync([basePath]);
    const baseStat = stat.get(basePath);
    if (baseStat?.exists && baseStat.isDirectory) {
      const indexPaths = indexFiles.map((idx) => path.join(basePath, idx));
      const indexResults = await batchStatAsync(indexPaths);
      return findIndexFileInResults(basePath, indexFiles, indexResults);
    }
  } else if (isDirectory) {
    const indexPaths = indexFiles.map((idx) => path.join(basePath, idx));
    const indexResults = await batchStatAsync(indexPaths);
    return findIndexFileInResults(basePath, indexFiles, indexResults);
  }

  return null;
}

// convenience functions (pre-configured probing for common use cases)

// probe for TypeScript/JavaScript files (sync)
// uses TYPESCRIPT_RESOLUTION_EXTENSIONS & TS_INDEX_FILES
export function probeTypeScriptFile(basePath: string): string | null {
  return probeFile(basePath, {
    extensions: TYPESCRIPT_RESOLUTION_EXTENSIONS,
    indexFiles: TS_INDEX_FILES,
    // TypeScript paths can resolve into node_modules
    skipNodeModules: false,
  });
}

// probe for TypeScript/JavaScript files (async)
// uses TYPESCRIPT_RESOLUTION_EXTENSIONS & TS_INDEX_FILES
export async function probeTypeScriptFileAsync(
  basePath: string
): Promise<string | null> {
  return probeFileAsync(basePath, {
    extensions: TYPESCRIPT_RESOLUTION_EXTENSIONS,
    indexFiles: TS_INDEX_FILES,
    // TypeScript paths can resolve into node_modules
    skipNodeModules: false,
  });
}

// probe for general module files including MDX (sync)
// uses FILE_PROBE_EXTENSIONS & FILE_PROBE_INDEX_FILES
export function probeModuleFile(basePath: string): string | null {
  return probeFile(basePath, {
    extensions: FILE_PROBE_EXTENSIONS,
    indexFiles: FILE_PROBE_INDEX_FILES,
    skipNodeModules: true,
  });
}

// probe for general module files including MDX (async)
// uses FILE_PROBE_EXTENSIONS & FILE_PROBE_INDEX_FILES
export async function probeModuleFileAsync(
  basePath: string
): Promise<string | null> {
  return probeFileAsync(basePath, {
    extensions: FILE_PROBE_EXTENSIONS,
    indexFiles: FILE_PROBE_INDEX_FILES,
    skipNodeModules: true,
  });
}
