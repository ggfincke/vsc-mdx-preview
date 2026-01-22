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

// probe for file existence with various extensions
function probeFile(basePath: string): string | null {
  // try exact path first with various extensions
  for (const ext of PROBE_EXTENSIONS) {
    const fullPath = basePath + ext;
    try {
      const stat = fs.statSync(fullPath);
      if (stat.isFile()) {
        return fullPath;
      }
    } catch {
      // file doesn't exist, continue
    }
  }

  // try as directory with index file
  try {
    const stat = fs.statSync(basePath);
    if (stat.isDirectory()) {
      for (const indexFile of INDEX_FILES) {
        const indexPath = path.join(basePath, indexFile);
        try {
          const indexStat = fs.statSync(indexPath);
          if (indexStat.isFile()) {
            return indexPath;
          }
        } catch {
          // index file doesn't exist, continue
        }
      }
    }
  } catch {
    // path doesn't exist, continue
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
