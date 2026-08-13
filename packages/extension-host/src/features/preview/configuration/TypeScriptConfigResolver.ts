// packages/extension-host/src/features/preview/configuration/TypeScriptConfigResolver.ts
// resolve & actively watch TypeScript configuration inputs

import * as path from 'path';
import type * as vscode from 'vscode';
import { LogTags } from '@mdx-preview/contracts';
import { parseTsconfig } from 'get-tsconfig';
import { getErrorReporter } from '../../../app/services';
import { ErrorContext } from '../../../shared/errors/ErrorReporter';
import { createTaggedLogger } from '../../../shared/logging/logger';
import { findUp } from '../../../shared/utils/find-up';
import { PathCache, type WatchHandlers } from '../../../shared/utils/cache';
import { normalizePathForComparison } from '../../../shared/utils/path-utils';
import type { TypeScriptConfiguration } from '../../module-runtime/types/module-system';

const log = createTaggedLogger(LogTags.TS_CONFIG);

// max 50 parsed configs while active watchers stay reference-owned
const TSCONFIG_CACHE_MAX_ENTRIES = 50;
const READ_CACHE_KEY_PREFIX = 'readFileSync:';
const READ_CACHE_KEY_SUFFIX = ':utf8';
const CONFIG_PROBE_KEY_PREFIXES = ['existsSync:', 'statSync:'];

interface CachedTypeScriptConfig {
  configuration: TypeScriptConfiguration | null;
  resolutionInputPaths: string[];
}

const configCache = new PathCache<CachedTypeScriptConfig>({
  logTag: LogTags.TS_CONFIG,
  maxEntries: TSCONFIG_CACHE_MAX_ENTRIES,
});
const configChangeListeners = new Set<(configFile: string) => void>();
const configRefreshListeners = new Set<() => void>();

function normalizeConfigPath(configPath: string): string {
  return normalizePathForComparison(path.resolve(configPath));
}

function getCacheKey(configFile: string): string {
  return path.dirname(normalizeConfigPath(configFile));
}

function getResolutionInputPath(cacheKey: string): string | undefined {
  if (
    cacheKey.startsWith(READ_CACHE_KEY_PREFIX) &&
    cacheKey.endsWith(READ_CACHE_KEY_SUFFIX)
  ) {
    return cacheKey.slice(
      READ_CACHE_KEY_PREFIX.length,
      -READ_CACHE_KEY_SUFFIX.length
    );
  }

  for (const prefix of CONFIG_PROBE_KEY_PREFIXES) {
    if (!cacheKey.startsWith(prefix)) {
      continue;
    }

    const probePath = cacheKey.slice(prefix.length);
    const basename = path.basename(probePath);
    if (/\.jsonc?$/i.test(basename) || /^tsconfig(?:\.|$)/i.test(basename)) {
      return probePath;
    }
  }

  return undefined;
}

// get-tsconfig records every config read or probed during extends resolution
function collectResolutionInputPaths(
  configFile: string,
  parseCache: Map<string, string>
): string[] {
  const inputPaths = new Set([normalizeConfigPath(configFile)]);

  for (const cacheKey of parseCache.keys()) {
    const inputPath = getResolutionInputPath(cacheKey);
    if (inputPath && path.isAbsolute(inputPath)) {
      inputPaths.add(normalizeConfigPath(inputPath));
    }
  }

  return [...inputPaths];
}

function notifyConfigChange(configFile: string): void {
  for (const listener of configChangeListeners) {
    listener(configFile);
  }
}

function handleConfigEvent(configFile: string, event: string): void {
  const normalizedConfigFile = normalizeConfigPath(configFile);
  log.debug(`TypeScript config ${event}: ${normalizedConfigFile}`);

  // extended inputs can contribute to any cached leaf
  configCache.clear();
  notifyConfigChange(normalizedConfigFile);
}

const configWatchHandlers: WatchHandlers<string, CachedTypeScriptConfig> = {
  onChange: (configFile) => handleConfigEvent(configFile, 'changed'),
  onCreate: (configFile) => handleConfigEvent(configFile, 'created'),
  onDelete: (configFile) => handleConfigEvent(configFile, 'deleted'),
};

// find tsconfig.json by walking up the directory tree
export function findTsConfig(directory: string): string | undefined {
  return findUp({
    filename: 'tsconfig.json',
    startDir: directory,
  });
}

// list every tsconfig.json path that can become nearest for this document
export function getTsConfigCandidatePaths(documentPath: string): string[] {
  const candidatePaths: string[] = [];
  let currentDir = path.dirname(path.resolve(documentPath));

  while (currentDir) {
    candidatePaths.push(
      normalizeConfigPath(path.join(currentDir, 'tsconfig.json'))
    );

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  return candidatePaths;
}

// resolve compiler options while retaining all inputs read from an extends chain
export function resolveTypescriptConfig(
  configFile: string | null
): TypeScriptConfiguration | null {
  if (!configFile) {
    return null;
  }

  const normalizedConfigFile = normalizeConfigPath(configFile);
  const cacheKey = getCacheKey(normalizedConfigFile);
  const cached = configCache.get(cacheKey);
  if (cached !== undefined) {
    return cached.configuration;
  }

  const parseCache = new Map<string, string>();

  try {
    const result = parseTsconfig(normalizedConfigFile, parseCache);
    const compilerOptions = result.compilerOptions ?? {};

    const configuration: TypeScriptConfiguration = {
      baseUrl: compilerOptions.baseUrl,
      paths: compilerOptions.paths as Record<string, string[]> | undefined,
      rootDir: compilerOptions.rootDir,
      configPath: normalizedConfigFile,
    };

    log.debug(
      `Parsed ${normalizedConfigFile}: baseUrl=${configuration.baseUrl}, paths=${Object.keys(configuration.paths ?? {}).length} aliases`
    );

    configCache.set(cacheKey, {
      configuration,
      resolutionInputPaths: collectResolutionInputPaths(
        normalizedConfigFile,
        parseCache
      ),
    });

    return configuration;
  } catch (err) {
    getErrorReporter().reportSilent(err, ErrorContext.Config, {
      configPath: normalizedConfigFile,
    });
    configCache.set(cacheKey, {
      configuration: null,
      resolutionInputPaths: collectResolutionInputPaths(
        normalizedConfigFile,
        parseCache
      ),
    });
    return null;
  }
}

function getActiveWatchPaths(documentPath: string): string[] {
  const activePaths = new Set(getTsConfigCandidatePaths(documentPath));
  const configFile = findTsConfig(path.dirname(documentPath));

  if (!configFile) {
    return [...activePaths];
  }

  const cacheKey = getCacheKey(configFile);
  if (!configCache.has(cacheKey)) {
    resolveTypescriptConfig(configFile);
  }

  const cached = configCache.peek(cacheKey);
  for (const inputPath of cached?.resolutionInputPaths ?? []) {
    activePaths.add(inputPath);
  }

  return [...activePaths];
}

function onTypeScriptConfigChange(
  listener: (configFile: string) => void
): vscode.Disposable {
  configChangeListeners.add(listener);
  return {
    dispose: () => configChangeListeners.delete(listener),
  };
}

// own the exact candidate & extends-input watcher set for one active preview
export function watchTypeScriptConfig(
  documentPath: string,
  listener: () => void
): vscode.Disposable {
  const ownedPaths = new Map<string, vscode.Disposable>();
  let disposed = false;

  const replaceOwnedPaths = () => {
    const nextPaths = new Set(getActiveWatchPaths(documentPath));

    for (const [configPath, disposable] of ownedPaths) {
      if (!nextPaths.has(configPath)) {
        disposable.dispose();
        ownedPaths.delete(configPath);
      }
    }

    for (const configPath of nextPaths) {
      if (!ownedPaths.has(configPath)) {
        ownedPaths.set(
          configPath,
          configCache.retainFile(configPath, configWatchHandlers)
        );
      }
    }
  };

  const notifyAndReplaceOwnedPaths = () => {
    try {
      listener();
    } finally {
      if (!disposed) {
        replaceOwnedPaths();
      }
    }
  };

  const changeSubscription = onTypeScriptConfigChange((configFile) => {
    if (!ownedPaths.has(configFile)) {
      return;
    }

    notifyAndReplaceOwnedPaths();
  });
  configRefreshListeners.add(notifyAndReplaceOwnedPaths);

  replaceOwnedPaths();

  return {
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      changeSubscription.dispose();
      configRefreshListeners.delete(notifyAndReplaceOwnedPaths);
      for (const disposable of ownedPaths.values()) {
        disposable.dispose();
      }
      ownedPaths.clear();
      configCache.clear();
    },
  };
}

// refresh active config values & replace their extends-input watcher ownership
export function refreshWatchedTypeScriptConfigs(): void {
  configCache.clear();
  for (const refreshListener of [...configRefreshListeners]) {
    refreshListener();
  }
  log.debug('Watched TypeScript configs refreshed');
}

export function clearTsConfigCache(): void {
  configCache.clear();
  log.debug('Config cache cleared');
}

export function disposeConfigWatchers(): void {
  configCache.dispose();
  configChangeListeners.clear();
  configRefreshListeners.clear();
  log.debug('Config watchers disposed');
}
