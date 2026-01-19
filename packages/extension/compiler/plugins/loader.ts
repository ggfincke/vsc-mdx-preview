// packages/extension/compiler/plugins/loader.ts
// * dynamic loading of custom remark/rehype plugins from workspace node_modules

import * as path from 'path';
import * as vscode from 'vscode';
import type { Pluggable } from 'unified';
import { debug, info } from '../../logging';
import type { PluginSpec, ResolvedConfig } from '../../preview/config';
import { getTrustManager, getErrorReporter } from '../../services';
import { getNodeResolver } from '../../module-system/resolver/resolver-factory';
import { PluginError } from '../../errors';
import { validateFunction } from '../../utils/validation';

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
  const pluginName = typeof spec === 'string' ? spec : spec[0];
  const pluginOptions = typeof spec === 'string' ? undefined : spec[1];

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
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to load plugin "${pluginName}": ${message}`);
  }
}

// result of loading plugins from config
export interface LoadedPlugins {
  // custom remark plugins to add after built-in plugins
  remarkPlugins: Pluggable[];
  // custom rehype plugins to add after built-in plugins
  rehypePlugins: Pluggable[];
  // count of plugins that failed to load (errors logged via ErrorReporter)
  errorCount: number;
}

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

  // check trust state - only load plugins in Trusted Mode (document-aware)
  const trustState = getTrustManager().getStateForDocument(documentUri);
  if (!trustState.canExecute) {
    const pluginCount =
      (remarkPlugins?.length ?? 0) + (rehypePlugins?.length ?? 0);
    getErrorReporter().reportPluginError(
      new PluginError(
        `Custom plugins configured but cannot load: ${trustState.reason || 'Safe Mode'}. ${pluginCount} plugin(s) will be ignored.`,
        'PLUGIN_LOAD_ERROR',
        'custom-plugins'
      ),
      'custom-plugins'
    );
    return result;
  }

  const configDir = config.configDir;
  info(`Loading custom plugins from ${path.basename(config.configPath)}...`);

  // load remark plugins
  if (remarkPlugins && remarkPlugins.length > 0) {
    for (const spec of remarkPlugins) {
      const pluginName = typeof spec === 'string' ? spec : spec[0];
      try {
        const plugin = await loadPlugin(spec, configDir);
        result.remarkPlugins.push(plugin);
        debug(`Loaded remark plugin: ${pluginName}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        result.errorCount++;
        getErrorReporter().reportPluginError(
          new PluginError(
            message,
            'PLUGIN_LOAD_ERROR',
            pluginName,
            err instanceof Error ? err : undefined
          ),
          pluginName
        );
      }
    }
  }

  // load rehype plugins
  if (rehypePlugins && rehypePlugins.length > 0) {
    for (const spec of rehypePlugins) {
      const pluginName = typeof spec === 'string' ? spec : spec[0];
      try {
        const plugin = await loadPlugin(spec, configDir);
        result.rehypePlugins.push(plugin);
        debug(`Loaded rehype plugin: ${pluginName}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        result.errorCount++;
        getErrorReporter().reportPluginError(
          new PluginError(
            message,
            'PLUGIN_LOAD_ERROR',
            pluginName,
            err instanceof Error ? err : undefined
          ),
          pluginName
        );
      }
    }
  }

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
