// packages/extension/compiler/plugins/loader.ts
// dynamic loading of custom remark/rehype plugins from workspace node_modules

import * as path from 'path';
import * as vscode from 'vscode';
import type { Pluggable } from 'unified';
import { debug, info } from '../../logging';
import type { PluginSpec, ResolvedConfig } from '../../types';
import { getErrorReporter } from '../../services';
import { tryRequireTrustedModeForDocument } from '../../security/validateTrust';
import { getNodeResolver } from '../../module-system/resolver/resolver-factory';
import { PluginError } from '../../errors';
import { validateFunction } from '../../utils/validation';
import { extractErrorMessage, isError } from '@mdx-preview/shared';
import { parsePluginSpec, getPluginName } from './utils';

// get shared node resolver instance for plugin resolution
const nodeResolver = getNodeResolver();

// resolve plugin module path from config directory (returns resolved absolute path to plugin module)
function resolvePluginPath(pluginName: string, configDir: string): string {
  const resolved = nodeResolver.resolveSync({}, configDir, pluginName);
  if (resolved === false || resolved === undefined) {
    throw new Error(
      `Cannot resolve plugin "${pluginName}" from ${configDir}. ` +
        `Make sure it is installed in your project's node_modules.`
    );
  }
  return resolved;
}

// load single plugin from plugin spec (returns Unified Pluggable: plugin function or [plugin, options] tuple)
async function loadPlugin(
  spec: PluginSpec,
  configDir: string
): Promise<Pluggable> {
  const { name: pluginName, options: pluginOptions } = parsePluginSpec(spec);

  try {
    const pluginPath = resolvePluginPath(pluginName, configDir);
    debug(`Loading plugin ${pluginName} from ${pluginPath}`);

    // use dynamic import for ESM/CJS compatibility
    const pluginModule = require(pluginPath);

    // handle both default export & module.exports patterns
    const pluginFn =
      pluginModule.default ?? pluginModule[pluginName] ?? pluginModule;

    const validatedFn = validateFunction(pluginFn, `plugin ${pluginName}`);
    if (!validatedFn) {
      throw new PluginError(
        `Plugin "${pluginName}" does not export a function. Got: ${typeof pluginFn}`,
        'PLUGIN_INVALID_EXPORT',
        pluginName
      );
    }

    if (pluginOptions) {
      return [pluginFn, pluginOptions] as Pluggable;
    }
    return pluginFn as Pluggable;
  } catch (err) {
    const message = extractErrorMessage(err);
    throw new Error(`Failed to load plugin "${pluginName}": ${message}`);
  }
}

interface LoadedPluginList {
  plugins: Pluggable[];
  errorCount: number;
}

// load a list of plugins for a specific Unified phase
async function loadPluginList(
  specs: PluginSpec[] | undefined,
  configDir: string,
  pluginType: 'remark' | 'rehype'
): Promise<LoadedPluginList> {
  const loaded: Pluggable[] = [];
  let errorCount = 0;

  if (!specs || specs.length === 0) {
    return { plugins: loaded, errorCount };
  }

  for (const spec of specs) {
    const pluginName = getPluginName(spec);
    try {
      const plugin = await loadPlugin(spec, configDir);
      loaded.push(plugin);
      debug(`Loaded ${pluginType} plugin: ${pluginName}`);
    } catch (err) {
      const message = extractErrorMessage(err);
      errorCount++;
      getErrorReporter().reportPluginError(
        new PluginError(
          message,
          'PLUGIN_LOAD_ERROR',
          pluginName,
          isError(err) ? err : undefined
        ),
        pluginName
      );
    }
  }

  return { plugins: loaded, errorCount };
}

// re-export canonical type definition from types/
export type { LoadedPlugins } from '../../types';

import type { LoadedPlugins } from '../../types';

// load custom plugins from MDX Preview config (only loads in Trusted Mode, returns empty arrays in Safe Mode w/ warning)
export async function loadPluginsFromConfig(
  config: ResolvedConfig | undefined,
  documentUri: vscode.Uri
): Promise<LoadedPlugins> {
  const result: LoadedPlugins = {
    remarkPlugins: [],
    rehypePlugins: [],
    errorCount: 0,
  };

  // no config = no custom plugins
  if (!config) {
    return result;
  }

  const { remarkPlugins, rehypePlugins } = config.config;

  // no plugins specified
  if (
    (!remarkPlugins || remarkPlugins.length === 0) &&
    (!rehypePlugins || rehypePlugins.length === 0)
  ) {
    return result;
  }

  // require Trusted Mode for custom plugin loading
  if (
    !tryRequireTrustedModeForDocument(
      documentUri,
      'load custom MDX plugins',
      (error) => {
        const pluginCount =
          (remarkPlugins?.length ?? 0) + (rehypePlugins?.length ?? 0);
        getErrorReporter().reportPluginError(
          new PluginError(
            `Custom plugins configured but cannot load: ${error.message}. ${pluginCount} plugin(s) will be ignored.`,
            'PLUGIN_LOAD_ERROR',
            'custom-plugins'
          ),
          'custom-plugins'
        );
      }
    )
  ) {
    return result;
  }

  const configDir = config.configDir;
  info(`Loading custom plugins from ${path.basename(config.configPath)}...`);

  // load remark plugins
  const loadedRemarkPlugins = await loadPluginList(
    remarkPlugins,
    configDir,
    'remark'
  );
  result.remarkPlugins.push(...loadedRemarkPlugins.plugins);
  result.errorCount += loadedRemarkPlugins.errorCount;

  // load rehype plugins
  const loadedRehypePlugins = await loadPluginList(
    rehypePlugins,
    configDir,
    'rehype'
  );
  result.rehypePlugins.push(...loadedRehypePlugins.plugins);
  result.errorCount += loadedRehypePlugins.errorCount;

  const loadedCount = result.remarkPlugins.length + result.rehypePlugins.length;
  const errorCount = result.errorCount;

  if (loadedCount > 0) {
    info(
      `Loaded ${loadedCount} custom plugin(s)` +
        (errorCount > 0 ? ` (${errorCount} failed)` : '')
    );
  }

  return result;
}

// merge custom plugins w/ built-in plugins (custom plugins added after built-in)
export function mergePlugins(
  builtIn: Pluggable[],
  custom: Pluggable[]
): Pluggable[] {
  if (custom.length === 0) {
    return builtIn;
  }
  return [...builtIn, ...custom];
}
