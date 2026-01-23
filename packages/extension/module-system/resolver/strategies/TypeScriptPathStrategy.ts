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
// Stat cache for file probing (reduces fs.statSync calls)
// ============================================================================

interface StatCacheEntry {
  exists: boolean;
  isFile: boolean;
  isDirectory: boolean;
  timestamp: number;
}

const STAT_CACHE_TTL_MS = 5000; // 5 seconds
const statCache = new Map<string, StatCacheEntry>();

function getCachedStat(filePath: string): StatCacheEntry | null {
  const entry = statCache.get(filePath);
  if (entry && Date.now() - entry.timestamp < STAT_CACHE_TTL_MS) {
    return entry;
  }
  return null;
}

function setCachedStat(
  filePath: string,
  stat: fs.Stats | null
): StatCacheEntry {
  const entry: StatCacheEntry = {
    exists: stat !== null,
    isFile: stat?.isFile() ?? false,
    isDirectory: stat?.isDirectory() ?? false,
    timestamp: Date.now(),
  };
  statCache.set(filePath, entry);
  return entry;
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

// match specifier against tsconfig paths patterns
// returns array of possible resolved paths, or null if no match
function matchTsPaths(
  specifier: string,
  paths: Record<string, string[]>,
  absoluteBaseUrl: string
): string[] | null {
  for (const [pattern, targets] of Object.entries(paths)) {
    // handle wildcard patterns (e.g., "@/*" -> ["src/*"])
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -2);
      if (specifier.startsWith(prefix + '/') || specifier === prefix) {
        const suffix =
          specifier === prefix ? '' : specifier.slice(prefix.length + 1);
        return targets.map((target) => {
          const targetPath = target.endsWith('/*')
            ? target.slice(0, -2)
            : target;
          return path.join(absoluteBaseUrl, targetPath, suffix);
        });
      }
    }
    // handle exact matches (e.g., "@utils" -> ["src/utils"])
    else if (specifier === pattern) {
      return targets.map((target) => path.join(absoluteBaseUrl, target));
    }
  }
  return null;
}

// probe for file existence with various extensions (uses stat cache)
function probeFile(basePath: string): string | null {
  // try exact path first with various extensions
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

    // try to match against paths
    const candidates = matchTsPaths(specifier, tsConfig.paths, absoluteBaseUrl);
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
}

// singleton instance
const { get: getTypeScriptPathStrategy } = createSingleton(
  () => new TypeScriptPathStrategy()
);

export { getTypeScriptPathStrategy };
