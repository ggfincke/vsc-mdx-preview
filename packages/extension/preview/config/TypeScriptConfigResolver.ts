// packages/extension/preview/config/TypeScriptConfigResolver.ts
// resolve TypeScript configuration from tsconfig.json using tsconfck (lightweight)

import * as path from 'path';
import { parse, type TSConfckParseResult } from 'tsconfck';
import { error as logError, debug } from '../../logging';
import { LogTags } from '@mdx-preview/shared';
import { findUp } from '../../utils/find-up';

// import consolidated type from centralized types
import type { TypeScriptConfiguration } from '../../types';

// cache parsed configs by directory to avoid repeated FS reads
const configCache = new Map<string, TypeScriptConfiguration | null>();

// find tsconfig.json by walking up the directory tree (uses shared find-up utility)
export function findTsConfig(directory: string): string | undefined {
  return findUp({
    filename: 'tsconfig.json',
    startDir: directory,
    // no stopAt = searches to filesystem root
  });
}

// resolve TypeScript configuration from a tsconfig.json file (async)
// handles extends, paths, baseUrl using tsconfck
export async function resolveTypescriptConfigAsync(
  configFile: string | null
): Promise<TypeScriptConfiguration | null> {
  if (!configFile) {
    return null;
  }

  // check cache
  const cacheKey = path.dirname(configFile);
  if (configCache.has(cacheKey)) {
    return configCache.get(cacheKey) ?? null;
  }

  try {
    const result: TSConfckParseResult = await parse(configFile);
    const compilerOptions = result.tsconfig?.compilerOptions ?? {};

    const config: TypeScriptConfiguration = {
      baseUrl: compilerOptions.baseUrl,
      paths: compilerOptions.paths,
      rootDir: compilerOptions.rootDir,
      configPath: configFile,
    };

    debug(
      `[${LogTags.TS_CONFIG}] Parsed ${configFile}: baseUrl=${config.baseUrl}, paths=${Object.keys(config.paths ?? {}).length} aliases`
    );

    configCache.set(cacheKey, config);
    return config;
  } catch (err) {
    logError(`[${LogTags.TS_CONFIG}] Failed to parse tsconfig:`, err);
    configCache.set(cacheKey, null);
    return null;
  }
}

// synchronous wrapper for cached access
// returns cached result if available, otherwise triggers async load & returns null
// use async version for guaranteed fresh data
export function resolveTypescriptConfig(
  configFile: string | null
): TypeScriptConfiguration | null {
  if (!configFile) {
    return null;
  }

  const cacheKey = path.dirname(configFile);
  if (configCache.has(cacheKey)) {
    return configCache.get(cacheKey) ?? null;
  }

  // if not cached, trigger async parse and return null for now
  // the async version will populate the cache
  resolveTypescriptConfigAsync(configFile).catch(() => {
    // ignore - error already logged
  });

  return null;
}

// clear the config cache (for testing or when tsconfig changes)
export function clearTsConfigCache(): void {
  configCache.clear();
  debug(`[${LogTags.TS_CONFIG}] Config cache cleared`);
}
