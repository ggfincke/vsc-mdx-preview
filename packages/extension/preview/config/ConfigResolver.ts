// packages/extension/preview/config/ConfigResolver.ts
// resolve .mdx-previewrc.json configuration files for custom plugins & components

import * as path from 'path';
import * as vscode from 'vscode';
import { info, debug } from '../../logging';
import { getConfigCache, getErrorReporter } from '../../services';
import { ConfigError } from '../../errors';
import { ConfigChangeType } from '../../config/ConfigCache';
import { validateConfigSchema } from '../../utils/validation';
import { readJsonSync, pathExists } from '../../utils/file-utils';

// import consolidated types from compiler/types.ts
import type {
  PluginSpec,
  ComponentMapping,
  UnknownBehavior,
} from '../../compiler/types';
import type { FrameworkName } from '@mdx-preview/shared';

// re-export types for backward compatibility
export type { PluginSpec, ComponentMapping, UnknownBehavior };

// framework-specific options
export interface FrameworkOptions {
  // enable/disable component shims for this project
  enableShims?: boolean;
  // custom import aliases (e.g., { "@components": "./src/components" })
  customAliases?: Record<string, string>;
}

// Tailwind CSS options
export interface TailwindOptions {
  enabled?: 'auto' | 'enabled' | 'disabled';
  configPath?: string;
}

// MDX Preview configuration file schema
export interface MdxPreviewConfig {
  // custom remark plugins to add after built-in plugins
  remarkPlugins?: PluginSpec[];
  // custom rehype plugins to add after built-in plugins
  rehypePlugins?: PluginSpec[];
  // custom component mappings for MDX
  components?: ComponentMapping;
  // framework override (overrides auto-detection)
  framework?: FrameworkName;
  // framework-specific options
  frameworkOptions?: FrameworkOptions;
  // Tailwind CSS options
  tailwind?: TailwindOptions;
  // how to handle unknown JSX components in Safe Mode
  unknownBehavior?: UnknownBehavior;
}

// resolved configuration w/ metadata
export interface ResolvedConfig {
  // the parsed configuration
  config: MdxPreviewConfig;
  // absolute path to the config file
  configPath: string;
  // directory containing the config file (for resolving relative paths)
  configDir: string;
}

// config file names to search for (in order of priority)
const CONFIG_FILE_NAMES = ['.mdx-previewrc.json', '.mdx-previewrc'];

// get ConfigCache instance via service locator
function getCache() {
  return getConfigCache();
}

// find & parse .mdx-previewrc.json config file for document
// searches from document's directory upward to workspace root
export function resolveConfig(documentPath: string): ResolvedConfig | null {
  const documentDir = path.dirname(documentPath);
  const cache = getCache();

  // check cache first (use get + undefined check instead of has + get for efficiency)
  const cached = cache.get(documentDir);
  if (cached !== undefined) {
    return cached;
  }

  const configPath = findConfigFile(documentDir);
  if (!configPath) {
    cache.set(documentDir, null);
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
    return null;
  }

  const resolved: ResolvedConfig = {
    config,
    configPath,
    configDir: path.dirname(configPath),
  };

  cache.set(documentDir, resolved);
  setupConfigWatcher(configPath);

  info(`Loaded MDX config from ${configPath}`);
  debug('Config contents:', config);

  return resolved;
}

// find config file by walking up directory tree
function findConfigFile(startDir: string): string | undefined {
  let currentDir = startDir;
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const workspaceRoots = workspaceFolders?.map((f) => f.uri.fsPath) ?? [];

  debug(`[CONFIG] Searching for config starting at: ${startDir}`);
  debug(`[CONFIG] Workspace roots: ${workspaceRoots.join(', ') || '(none)'}`);

  // walk up to workspace root or filesystem root
  while (currentDir) {
    for (const fileName of CONFIG_FILE_NAMES) {
      const configPath = path.join(currentDir, fileName);
      if (pathExists(configPath)) {
        debug(`[CONFIG] Found config file at: ${configPath}`);
        return configPath;
      }
    }

    // stop at workspace root
    if (workspaceRoots.some((root) => currentDir === root)) {
      debug(`[CONFIG] Reached workspace root: ${currentDir}`);
      break;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      // reached filesystem root
      debug(`[CONFIG] Reached filesystem root`);
      break;
    }
    currentDir = parentDir;
  }

  debug(`[CONFIG] No config file found`);
  return undefined;
}

// validate config structure using centralized validation
function validateConfig(config: unknown): string[] {
  const result = validateConfigSchema(config, { context: 'config' });
  return result.errors;
}

// setup file watcher for config file changes
function setupConfigWatcher(configPath: string): void {
  const cache = getCache();

  // already watching
  if (cache.hasWatcher(configPath)) {
    return;
  }

  const watcher = vscode.workspace.createFileSystemWatcher(configPath);

  watcher.onDidChange(() => {
    debug(`Config file changed: ${configPath}`);
    cache.invalidate(configPath);
    cache.notifyChange(configPath, ConfigChangeType.FileChanged);
  });

  watcher.onDidCreate(() => {
    debug(`Config file created: ${configPath}`);
    cache.invalidate(configPath);
    cache.notifyChange(configPath, ConfigChangeType.FileCreated);
  });

  watcher.onDidDelete(() => {
    debug(`Config file deleted: ${configPath}`);
    cache.invalidate(configPath);
    cache.notifyChange(configPath, ConfigChangeType.FileDeleted);
    // clean up watcher
    cache.removeWatcher(configPath);
  });

  cache.setWatcher(configPath, watcher);
}

// subscribe to config file changes
// callback receives a ConfigChangeEvent w/ type, configPath, & timestamp
export function onConfigChange(
  callback: (
    event: import('../../config/ConfigCache').ConfigChangeEvent
  ) => void
): vscode.Disposable {
  return getCache().subscribe(callback);
}

// clear all cached configs (for testing or manual refresh)
export function clearConfigCache(): void {
  getCache().clear();
}

// dispose all config watchers (call during extension deactivation)
// note: now handled by ConfigCache.dispose() via ServiceRegistry,
// but kept for backward compatibility w/ extension.ts
export function disposeConfigWatchers(): void {
  // ConfigCache handles cleanup via dispose(), which is called by ServiceRegistry
  // this function is kept for backward compatibility but delegates to clear()
  getCache().clear();
}

// get list of config file names (for schema registration)
export function getConfigFileNames(): string[] {
  return [...CONFIG_FILE_NAMES];
}
