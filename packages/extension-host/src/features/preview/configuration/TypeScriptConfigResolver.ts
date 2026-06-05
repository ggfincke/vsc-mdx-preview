// packages/extension-host/src/features/preview/configuration/TypeScriptConfigResolver.ts
// resolve TypeScript configuration from tsconfig.json using get-tsconfig (lightweight)

import * as path from 'path';
import { parseTsconfig } from 'get-tsconfig';
import { createTaggedLogger } from '../../../shared/logging/logger';
import { LogTags } from '@mdx-preview/contracts';
import { getErrorReporter } from '../../../app/services';
import { ErrorContext } from '../../../shared/errors/ErrorReporter';

// module-level tagged logger
const log = createTaggedLogger(LogTags.TS_CONFIG);
import { findUp } from '../../../shared/utils/find-up';
import { PathCache } from '../../../shared/utils/cache';

// import consolidated type from centralized types
import type { TypeScriptConfiguration } from '../../types';

// max 50 tsconfig caches (typical monorepo has fewer)
const TSCONFIG_CACHE_MAX_ENTRIES = 50;

// cache parsed configs by directory (LRU prevents unbounded growth)
const configCache = new PathCache<TypeScriptConfiguration | null>({
  logTag: LogTags.TS_CONFIG,
  maxEntries: TSCONFIG_CACHE_MAX_ENTRIES,
});

// find tsconfig.json by walking up the directory tree (uses shared find-up utility)
export function findTsConfig(directory: string): string | undefined {
  return findUp({
    filename: 'tsconfig.json',
    startDir: directory,
    // no stopAt = searches to filesystem root
  });
}

// setup a file watcher for a tsconfig.json file to invalidate cache on changes
function setupConfigWatcher(configFile: string): void {
  if (configCache.hasWatcher(configFile)) {
    return;
  }

  const cacheKey = path.dirname(configFile);

  // ! intentional divergence from ConfigResolver: no onCreate handler here
  // ConfigResolver invalidates + notifies on file create; this resolver omits it
  // pending a deliberate bugfix (adding it would change cache behavior unguarded)
  configCache.watchPath(configFile, {
    onChange: () => {
      log.debug(`tsconfig.json changed: ${configFile}`);
      configCache.delete(cacheKey);
    },
    onDelete: () => {
      log.debug(`tsconfig.json deleted: ${configFile}`);
      configCache.delete(cacheKey);
      // clean up watcher for deleted file
      configCache.unwatchPath(configFile);
    },
  });
  log.debug(`Watching: ${configFile}`);
}

// resolve TypeScript configuration from tsconfig.json (handle extends, paths, baseUrl)
export function resolveTypescriptConfig(
  configFile: string | null
): TypeScriptConfiguration | null {
  if (!configFile) {
    return null;
  }

  // check cache
  const cacheKey = path.dirname(configFile);
  if (configCache.has(cacheKey)) {
    return configCache.get(cacheKey) ?? null;
  }

  try {
    const result = parseTsconfig(configFile);
    const compilerOptions = result.compilerOptions ?? {};

    const config: TypeScriptConfiguration = {
      baseUrl: compilerOptions.baseUrl,
      paths: compilerOptions.paths as Record<string, string[]> | undefined,
      rootDir: compilerOptions.rootDir,
      configPath: configFile,
    };

    log.debug(
      `Parsed ${configFile}: baseUrl=${config.baseUrl}, paths=${Object.keys(config.paths ?? {}).length} aliases`
    );

    configCache.set(cacheKey, config);

    // setup watcher to invalidate cache when tsconfig changes
    setupConfigWatcher(configFile);

    return config;
  } catch (err) {
    getErrorReporter().reportSilent(err, ErrorContext.Config, {
      configPath: configFile,
    });
    configCache.set(cacheKey, null);
    return null;
  }
}

// clear the config cache (for testing or when tsconfig changes)
export function clearTsConfigCache(): void {
  configCache.clear();
  log.debug('Config cache cleared');
}

// dispose all config file watchers (called during extension deactivation)
export function disposeConfigWatchers(): void {
  configCache.dispose();
  log.debug('Config watchers disposed');
}
