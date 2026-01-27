// packages/extension/preview/config/TypeScriptConfigResolver.ts
// resolve TypeScript configuration from tsconfig.json using tsconfck (lightweight)

import * as path from 'path';
import { parse, type TSConfckParseResult } from 'tsconfck';
import { error as logError, debug } from '../../logging';
import { findUp } from '../../utils/find-up';

// import consolidated type from module-system/types.ts
import type { TypeScriptConfiguration } from '../../module-system/types';

// re-export type for backward compatibility
export type { TypeScriptConfiguration };

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
      `[TS-CONFIG] Parsed ${configFile}: baseUrl=${config.baseUrl}, paths=${Object.keys(config.paths ?? {}).length} aliases`
    );

    configCache.set(cacheKey, config);
    return config;
  } catch (err) {
    logError('[TS-CONFIG] Failed to parse tsconfig:', err);
    configCache.set(cacheKey, null);
    return null;
  }
}

// synchronous wrapper for backward compatibility
// uses cached results if available, otherwise returns null
// caller should use async version for initial load
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
  debug('[TS-CONFIG] Config cache cleared');
}
