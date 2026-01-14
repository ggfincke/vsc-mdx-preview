// packages/extension/preview/config/ConfigResolver.ts
// resolve .mdx-previewrc.json configuration files for custom plugins & components

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { warn, info, debug } from '../../logging';
import { ConfigCache } from '../../config/ConfigCache';

// plugin specification format: string (e.g., "remark-toc") or [string, options] tuple (e.g., ["remark-toc", { tight: true }])
export type PluginSpec = string | [string, Record<string, unknown>];

// component mapping: MDX component name -> relative path to component file (e.g., { "Callout": "./src/components/Callout.tsx" })
export type ComponentMapping = Record<string, string>;

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
  framework?: 'generic' | 'docusaurus' | 'nextjs' | 'astro-starlight';
  // framework-specific options
  frameworkOptions?: FrameworkOptions;
  // Tailwind CSS options
  tailwind?: TailwindOptions;
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

// get ConfigCache instance (lazy - avoids circular dependency issues)
function getCache(): ConfigCache {
  return ConfigCache.getInstance();
}

// find & parse .mdx-previewrc.json config file for document (searches from document's directory upward to workspace root)
export function resolveConfig(documentPath: string): ResolvedConfig | null {
  const documentDir = path.dirname(documentPath);
  const cache = getCache();

  // check cache first
  if (cache.has(documentDir)) {
    return cache.get(documentDir) ?? null;
  }

  const configPath = findConfigFile(documentDir);
  if (!configPath) {
    cache.set(documentDir, null);
    return null;
  }

  try {
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent) as MdxPreviewConfig;

    // validate config structure
    const validationErrors = validateConfig(config);
    if (validationErrors.length > 0) {
      warn(`Invalid config in ${configPath}:`, validationErrors.join(', '));
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
  } catch (err) {
    warn(`Failed to parse config file ${configPath}:`, err);
    cache.set(documentDir, null);
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
      // reached filesystem root
      break;
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

  // validate framework
  if (cfg.framework !== undefined) {
    const validFrameworks = [
      'generic',
      'docusaurus',
      'nextjs',
      'astro-starlight',
    ];
    if (
      typeof cfg.framework !== 'string' ||
      !validFrameworks.includes(cfg.framework)
    ) {
      errors.push(`framework must be one of: ${validFrameworks.join(', ')}`);
    }
  }

  // validate frameworkOptions
  if (cfg.frameworkOptions !== undefined) {
    if (
      typeof cfg.frameworkOptions !== 'object' ||
      cfg.frameworkOptions === null
    ) {
      errors.push('frameworkOptions must be an object');
    } else {
      const opts = cfg.frameworkOptions as Record<string, unknown>;

      // validate enableShims
      if (
        opts.enableShims !== undefined &&
        typeof opts.enableShims !== 'boolean'
      ) {
        errors.push('frameworkOptions.enableShims must be a boolean');
      }

      // validate customAliases
      if (opts.customAliases !== undefined) {
        if (
          typeof opts.customAliases !== 'object' ||
          opts.customAliases === null
        ) {
          errors.push('frameworkOptions.customAliases must be an object');
        } else {
          for (const [alias, target] of Object.entries(opts.customAliases)) {
            if (typeof target !== 'string') {
              errors.push(
                `frameworkOptions.customAliases.${alias} must be a string path`
              );
            }
          }
        }
      }
    }
  }

  // validate tailwind options
  if (cfg.tailwind !== undefined) {
    if (typeof cfg.tailwind !== 'object' || cfg.tailwind === null) {
      errors.push('tailwind must be an object');
    } else {
      const tailwind = cfg.tailwind as Record<string, unknown>;
      const validEnabled = ['auto', 'enabled', 'disabled'];
      if (
        tailwind.enabled !== undefined &&
        (typeof tailwind.enabled !== 'string' ||
          !validEnabled.includes(tailwind.enabled))
      ) {
        errors.push(
          `tailwind.enabled must be one of: ${validEnabled.join(', ')}`
        );
      }
      if (
        tailwind.configPath !== undefined &&
        typeof tailwind.configPath !== 'string'
      ) {
        errors.push('tailwind.configPath must be a string path');
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
  const cache = getCache();

  if (cache.hasWatcher(configPath)) {
    return; // already watching
  }

  const watcher = vscode.workspace.createFileSystemWatcher(configPath);

  const handleChange = () => {
    debug(`Config file changed: ${configPath}`);
    cache.invalidate(configPath);
    cache.notifyChange(configPath);
  };

  watcher.onDidChange(handleChange);
  watcher.onDidCreate(handleChange);
  watcher.onDidDelete(() => {
    debug(`Config file deleted: ${configPath}`);
    cache.invalidate(configPath);
    cache.notifyChange(configPath);
    // clean up watcher
    cache.removeWatcher(configPath);
  });

  cache.setWatcher(configPath, watcher);
}

// subscribe to config file changes
export function onConfigChange(
  callback: (configPath: string) => void
): vscode.Disposable {
  return getCache().subscribe(callback);
}

// clear all cached configs (for testing or manual refresh)
export function clearConfigCache(): void {
  getCache().clear();
}

// dispose all config watchers (call during extension deactivation)
// Note: This is now handled by ConfigCache.dispose() via ServiceRegistry,
// but we keep this for backward compatibility w/ extension.ts
export function disposeConfigWatchers(): void {
  // ConfigCache handles cleanup via dispose(), which is called by ServiceRegistry
  // This function is kept for backward compatibility but delegates to clear()
  getCache().clear();
}

// get list of config file names (for schema registration)
export function getConfigFileNames(): string[] {
  return [...CONFIG_FILE_NAMES];
}
