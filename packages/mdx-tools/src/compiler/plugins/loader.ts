import * as path from 'path';
import type { Pluggable } from 'unified';
import { extractErrorMessage, isError } from '../../internal/errors';
import { getLogger } from '../internal/logging';
import { DEFAULT_PLUGIN_LOADER } from '../internal/plugin-loader';
import { requireTrustedMode } from '../internal/trust';
import type {
  CompilerConfig,
  LoadedPlugins,
  PluginLoadError,
  PluginLoader,
  PluginSpec,
  ResolvedConfig,
} from '../types';
import { getPluginName, parsePluginSpec } from './utils';

function resolvePluginPath(
  pluginName: string,
  configDir: string,
  loader: PluginLoader
): string {
  try {
    return loader.resolve(pluginName, configDir);
  } catch (error) {
    throw new Error(
      `Cannot resolve plugin "${pluginName}" from ${configDir}. ` +
        `Make sure it is installed in your project's node_modules.`,
      {
        cause: error,
      }
    );
  }
}

async function loadPlugin(
  spec: PluginSpec,
  configDir: string,
  loader: PluginLoader,
  logger: ReturnType<typeof getLogger>
): Promise<Pluggable> {
  const { name: pluginName, options: pluginOptions } = parsePluginSpec(spec);

  const pluginPath = resolvePluginPath(pluginName, configDir, loader);
  logger.debug(`Loading plugin ${pluginName} from ${pluginPath}`);

  try {
    const pluginModule = await loader.load(pluginPath);
    const pluginRecord = pluginModule as Record<string, unknown>;
    const pluginFn =
      pluginRecord.default ?? pluginRecord[pluginName] ?? pluginModule;

    if (typeof pluginFn !== 'function') {
      throw new Error(
        `Plugin "${pluginName}" does not export a function. Got: ${typeof pluginFn}`
      );
    }

    return pluginOptions
      ? ([pluginFn, pluginOptions] as Pluggable)
      : (pluginFn as Pluggable);
  } catch (error) {
    const message = extractErrorMessage(error);
    throw new Error(`Failed to load plugin "${pluginName}": ${message}`, {
      cause: error,
    });
  }
}

function reportPluginError(
  compilerConfig: CompilerConfig,
  pluginError: PluginLoadError,
  logger: ReturnType<typeof getLogger>
): void {
  if (compilerConfig.errorReporter) {
    compilerConfig.errorReporter.reportPluginError(pluginError);
    return;
  }

  logger.warn(`${pluginError.message} (code: ${pluginError.code})`);
}

interface LoadedPluginList {
  plugins: Pluggable[];
  errorCount: number;
}

async function loadPluginList(
  specs: PluginSpec[] | undefined,
  configDir: string,
  pluginType: 'remark' | 'rehype',
  compilerConfig: CompilerConfig,
  loader: PluginLoader,
  logger: ReturnType<typeof getLogger>
): Promise<LoadedPluginList> {
  const loaded: Pluggable[] = [];
  let errorCount = 0;

  if (!specs || specs.length === 0) {
    return { plugins: loaded, errorCount };
  }

  for (const spec of specs) {
    const pluginName = getPluginName(spec);
    try {
      const plugin = await loadPlugin(spec, configDir, loader, logger);
      loaded.push(plugin);
      logger.debug(`Loaded ${pluginType} plugin: ${pluginName}`);
    } catch (error) {
      errorCount++;
      reportPluginError(
        compilerConfig,
        {
          code: 'PLUGIN_LOAD_ERROR',
          pluginName,
          message: extractErrorMessage(error),
          cause: isError(error) ? error : undefined,
        },
        logger
      );
    }
  }

  return { plugins: loaded, errorCount };
}

export async function loadPluginsFromConfig(
  config: ResolvedConfig | undefined,
  compilerConfig: CompilerConfig
): Promise<LoadedPlugins> {
  const logger = getLogger(compilerConfig.logger);
  const loader = compilerConfig.pluginLoader ?? DEFAULT_PLUGIN_LOADER;

  const result: LoadedPlugins = {
    remarkPlugins: [],
    rehypePlugins: [],
    errorCount: 0,
  };

  if (!config) {
    return result;
  }

  const { remarkPlugins, rehypePlugins } = config.config;
  const hasPlugins =
    (remarkPlugins?.length ?? 0) + (rehypePlugins?.length ?? 0) > 0;
  if (!hasPlugins) {
    return result;
  }

  const trusted = requireTrustedMode(
    compilerConfig,
    'load custom MDX plugins',
    (error) => {
      reportPluginError(
        compilerConfig,
        {
          code: 'PLUGIN_LOAD_ERROR',
          pluginName: 'custom-plugins',
          message:
            `Custom plugins configured but cannot load: ${error.message}. ` +
            `${(remarkPlugins?.length ?? 0) + (rehypePlugins?.length ?? 0)} plugin(s) will be ignored.`,
          cause: error,
        },
        logger
      );
    }
  );

  if (!trusted) {
    return result;
  }

  const configDir = config.configDir;
  logger.info(
    `Loading custom plugins from ${path.basename(config.configPath)}...`
  );

  const loadedRemarkPlugins = await loadPluginList(
    remarkPlugins,
    configDir,
    'remark',
    compilerConfig,
    loader,
    logger
  );
  result.remarkPlugins.push(...loadedRemarkPlugins.plugins);
  result.errorCount += loadedRemarkPlugins.errorCount;

  const loadedRehypePlugins = await loadPluginList(
    rehypePlugins,
    configDir,
    'rehype',
    compilerConfig,
    loader,
    logger
  );
  result.rehypePlugins.push(...loadedRehypePlugins.plugins);
  result.errorCount += loadedRehypePlugins.errorCount;

  const loadedCount = result.remarkPlugins.length + result.rehypePlugins.length;
  if (loadedCount > 0) {
    logger.info(
      `Loaded ${loadedCount} custom plugin(s)` +
        (result.errorCount > 0 ? ` (${result.errorCount} failed)` : '')
    );
  }

  return result;
}

export function mergePlugins(
  builtIn: Pluggable[],
  custom: Pluggable[]
): Pluggable[] {
  if (custom.length === 0) {
    return builtIn;
  }
  return [...builtIn, ...custom];
}
