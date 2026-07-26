// packages/extension-host/src/features/preview/configuration/ConfigResolver.ts
// resolve .mdx-previewrc.json configuration files for custom plugins & components

import * as path from 'path';
import * as vscode from 'vscode';
import { createTaggedLogger } from '../../../shared/logging/logger';
import { getConfigCache, getErrorReporter } from '../../../app/services';
import { ConfigError } from '../../../shared/errors';
import { ConfigChangeType } from '../../../shared/config/ConfigCache';
import { validateConfigSchema } from '../../../shared/utils/validation';
import { readJsonSync } from '../../../shared/utils/file-utils';
import {
  findUp,
  createWorkspaceStopPredicate,
} from '../../../shared/utils/find-up';

// import consolidated types from centralized types
import type { MdxPreviewConfig, ResolvedConfig } from '../../types';
import { LogTags } from '@mdx-preview/contracts';

// module-level tagged logger
const log = createTaggedLogger(LogTags.CONFIG);

// config file names to search for (in order of priority)
const CONFIG_FILE_NAMES = ['.mdx-previewrc.json', '.mdx-previewrc'];

// find & parse .mdx-previewrc.json config file for document
// search from document's directory upward to workspace root
export function resolveConfig(documentPath: string): ResolvedConfig | null {
  const documentDir = path.dirname(documentPath);
  const cache = getConfigCache();

  // check cache first (use get + undefined check instead of has + get for efficiency)
  const cached = cache.get(documentDir);
  if (cached !== undefined) {
    return cached;
  }

  const configPath = findConfigFile(documentDir);
  if (!configPath) {
    cache.set(documentDir, null);
    setupCandidateWatchers(documentDir);
    return null;
  }

  // read & parse config file
  const config = readJsonSync<MdxPreviewConfig>(configPath);
  if (!config) {
    getErrorReporter().reportConfigError(
      new ConfigError(
        'Failed to read or parse config file',
        'CONFIG_PARSE_ERROR',
        configPath
      ),
      configPath
    );
    cache.set(documentDir, null);
    setupCandidateWatchers(documentDir);
    return null;
  }

  // validate config structure
  const validationErrors = validateConfig(config);
  if (validationErrors.length > 0) {
    getErrorReporter().reportConfigError(
      new ConfigError(
        `Invalid config: ${validationErrors.join(', ')}`,
        'CONFIG_VALIDATION_ERROR',
        configPath
      ),
      configPath
    );
    cache.set(documentDir, null);
    setupCandidateWatchers(documentDir);
    return null;
  }

  const resolved: ResolvedConfig = {
    config,
    configPath,
    configDir: path.dirname(configPath),
  };

  cache.set(documentDir, resolved);
  setupConfigWatcher(configPath);

  log.info(`Loaded MDX config from ${configPath}`);
  log.debug('Config contents:', config);

  return resolved;
}

// find config file by walking up directory tree (uses shared find-up utility)
export function findConfigFile(startDir: string): string | undefined {
  log.debug(`Searching for config starting at: ${startDir}`);

  const result = findUp({
    filename: CONFIG_FILE_NAMES,
    startDir,
    stopAt: createWorkspaceStopPredicate(),
  });

  if (result) {
    log.debug(`Found config file at: ${result}`);
  } else {
    log.debug('No config file found');
  }

  return result;
}

// watch every path that could become the nearest config
function setupCandidateWatchers(startDir: string): void {
  const shouldStop = createWorkspaceStopPredicate();
  let currentDir = startDir;

  while (currentDir) {
    for (const filename of CONFIG_FILE_NAMES) {
      setupConfigWatcher(path.join(currentDir, filename), true);
    }

    if (shouldStop(currentDir)) {
      break;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }
}

// validate config structure using centralized validation
function validateConfig(config: unknown): string[] {
  const result = validateConfigSchema(config, { context: 'config' });
  return result.errors;
}

// setup file watcher for config file changes
function setupConfigWatcher(configPath: string, candidate = false): void {
  const cache = getConfigCache();

  // already watching
  if (cache.hasWatcher(configPath)) {
    return;
  }

  const handlers = {
    onChange: () => {
      log.debug(`File changed: ${configPath}`);
      cache.invalidate(configPath);
      cache.notifyChange(configPath, ConfigChangeType.FileChanged);
    },
    onCreate: () => {
      log.debug(`File created: ${configPath}`);
      cache.invalidate(configPath);
      cache.notifyChange(configPath, ConfigChangeType.FileCreated);
    },
    onDelete: () => {
      log.debug(`File deleted: ${configPath}`);
      cache.invalidate(configPath);
      cache.notifyChange(configPath, ConfigChangeType.FileDeleted);
    },
  };

  if (candidate) {
    cache.watchConfigCandidate(configPath, handlers);
  } else {
    cache.watchConfigPath(configPath, handlers);
  }
}

// subscribe to config file changes
// callback: receive ConfigChangeEvent w/ type, configPath, & timestamp
export function onConfigChange(
  callback: (
    event: import('../../../shared/config/ConfigCache').ConfigChangeEvent
  ) => void
): vscode.Disposable {
  return getConfigCache().subscribe(callback);
}
