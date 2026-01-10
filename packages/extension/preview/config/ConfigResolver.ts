// packages/extension/preview/config/ConfigResolver.ts
// resolve .mdx-previewrc.json configuration files for custom plugins & components

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { warn, info, debug } from '../../logging';

// plugin specification format: string (e.g., "remark-toc") or [string, options] tuple (e.g., ["remark-toc", { tight: true }])
export type PluginSpec = string | [string, Record<string, unknown>];

// component mapping: MDX component name -> relative path to component file (e.g., { "Callout": "./src/components/Callout.tsx" })
export type ComponentMapping = Record<string, string>;

// MDX Preview configuration file schema
export interface MdxPreviewConfig {
  // custom remark plugins to add after built-in plugins
  remarkPlugins?: PluginSpec[];
  // custom rehype plugins to add after built-in plugins
  rehypePlugins?: PluginSpec[];
  // custom component mappings for MDX
  components?: ComponentMapping;
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

// cache config per workspace folder to avoid repeated file system reads
const configCache = new Map<string, ResolvedConfig | null>();

// file system watchers for config files
const configWatchers = new Map<string, vscode.FileSystemWatcher>();

// subscribers for config change notifications
const configChangeSubscribers = new Set<(configPath: string) => void>();

// find & parse .mdx-previewrc.json config file for document (searches from document's directory upward to workspace root)
export function resolveConfig(documentPath: string): ResolvedConfig | null {
  const documentDir = path.dirname(documentPath);

  // check cache first
  if (configCache.has(documentDir)) {
    return configCache.get(documentDir) ?? null;
  }

  const configPath = findConfigFile(documentDir);
  if (!configPath) {
    configCache.set(documentDir, null);
    return null;
  }

  try {
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent) as MdxPreviewConfig;

    // validate config structure
    const validationErrors = validateConfig(config);
    if (validationErrors.length > 0) {
      warn(`Invalid config in ${configPath}:`, validationErrors.join(', '));
      configCache.set(documentDir, null);
      return null;
    }

    const resolved: ResolvedConfig = {
      config,
      configPath,
      configDir: path.dirname(configPath),
    };

    configCache.set(documentDir, resolved);
    setupConfigWatcher(configPath);

    info(`Loaded MDX config from ${configPath}`);
    debug('Config contents:', config);

    return resolved;
  } catch (err) {
    warn(`Failed to parse config file ${configPath}:`, err);
    configCache.set(documentDir, null);
    return null;
  }
}

// find config file by walking up directory tree
function findConfigFile(startDir: string): string | undefined {
  let currentDir = startDir;
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const workspaceRoots = workspaceFolders?.map((f) => f.uri.fsPath) ?? [];

  // walk up to workspace root or filesystem root
  while (currentDir) {
    for (const fileName of CONFIG_FILE_NAMES) {
      const configPath = path.join(currentDir, fileName);
      if (fs.existsSync(configPath)) {
        return configPath;
      }
    }

    // stop at workspace root
    if (workspaceRoots.some((root) => currentDir === root)) {
      break;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break; // reached filesystem root
    }
    currentDir = parentDir;
  }

  return undefined;
}

// validate config structure
function validateConfig(config: unknown): string[] {
  const errors: string[] = [];

  if (typeof config !== 'object' || config === null) {
    errors.push('Config must be an object');
    return errors;
  }

  const cfg = config as Record<string, unknown>;

  // validate remarkPlugins
  if (cfg.remarkPlugins !== undefined) {
    if (!Array.isArray(cfg.remarkPlugins)) {
      errors.push('remarkPlugins must be an array');
    } else {
      for (let i = 0; i < cfg.remarkPlugins.length; i++) {
        const plugin = cfg.remarkPlugins[i];
        if (!isValidPluginSpec(plugin)) {
          errors.push(
            `remarkPlugins[${i}] must be a string or [string, options] tuple`
          );
        }
      }
    }
  }

  // validate rehypePlugins
  if (cfg.rehypePlugins !== undefined) {
    if (!Array.isArray(cfg.rehypePlugins)) {
      errors.push('rehypePlugins must be an array');
    } else {
      for (let i = 0; i < cfg.rehypePlugins.length; i++) {
        const plugin = cfg.rehypePlugins[i];
        if (!isValidPluginSpec(plugin)) {
          errors.push(
            `rehypePlugins[${i}] must be a string or [string, options] tuple`
          );
        }
      }
    }
  }

  // validate components
  if (cfg.components !== undefined) {
    if (typeof cfg.components !== 'object' || cfg.components === null) {
      errors.push('components must be an object');
    } else {
      for (const [name, pathValue] of Object.entries(cfg.components)) {
        if (typeof pathValue !== 'string') {
          errors.push(`components.${name} must be a string path`);
        }
      }
    }
  }

  return errors;
}

// check if value is valid plugin spec
function isValidPluginSpec(value: unknown): value is PluginSpec {
  if (typeof value === 'string') {
    return true;
  }
  if (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === 'string' &&
    typeof value[1] === 'object' &&
    value[1] !== null
  ) {
    return true;
  }
  return false;
}

// setup file watcher for config file changes
function setupConfigWatcher(configPath: string): void {
  if (configWatchers.has(configPath)) {
    return; // already watching
  }

  const watcher = vscode.workspace.createFileSystemWatcher(configPath);

  const handleChange = () => {
    debug(`Config file changed: ${configPath}`);
    invalidateConfigCache(configPath);
    notifyConfigChange(configPath);
  };

  watcher.onDidChange(handleChange);
  watcher.onDidCreate(handleChange);
  watcher.onDidDelete(() => {
    debug(`Config file deleted: ${configPath}`);
    invalidateConfigCache(configPath);
    notifyConfigChange(configPath);
    // clean up watcher
    watcher.dispose();
    configWatchers.delete(configPath);
  });

  configWatchers.set(configPath, watcher);
}

// invalidate cached config for given config file path
function invalidateConfigCache(configPath: string): void {
  const configDir = path.dirname(configPath);

  // remove all cache entries that could be affected by this config file
  for (const [cachedDir, resolved] of configCache.entries()) {
    if (
      resolved?.configPath === configPath ||
      cachedDir.startsWith(configDir)
    ) {
      configCache.delete(cachedDir);
    }
  }
}

// notify subscribers of config change
function notifyConfigChange(configPath: string): void {
  for (const callback of configChangeSubscribers) {
    try {
      callback(configPath);
    } catch (err) {
      warn('Error in config change callback:', err);
    }
  }
}

// subscribe to config file changes
export function onConfigChange(
  callback: (configPath: string) => void
): vscode.Disposable {
  configChangeSubscribers.add(callback);
  return {
    dispose: () => {
      configChangeSubscribers.delete(callback);
    },
  };
}

// clear all cached configs (for testing or manual refresh)
export function clearConfigCache(): void {
  configCache.clear();
}

// dispose all config watchers (call during extension deactivation)
export function disposeConfigWatchers(): void {
  for (const watcher of configWatchers.values()) {
    watcher.dispose();
  }
  configWatchers.clear();
  configChangeSubscribers.clear();
  configCache.clear();
}

// get list of config file names (for schema registration)
export function getConfigFileNames(): string[] {
  return [...CONFIG_FILE_NAMES];
}
