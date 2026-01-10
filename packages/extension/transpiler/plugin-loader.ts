// packages/extension/transpiler/plugin-loader.ts
// * dynamic loading of custom remark/rehype plugins from workspace node_modules

import * as path from 'path';
import * as fs from 'fs';
import { CachedInputFileSystem, ResolverFactory } from 'enhanced-resolve';
import type { Resolver } from 'enhanced-resolve';
import type { Pluggable } from 'unified';
import { warn, debug, info } from '../logging';
import type { PluginSpec, ResolvedConfig } from '../preview/config';
import { TrustManager, SecurityMode } from '../security/TrustManager';

// cached file system for resolver
const cachedFs = new CachedInputFileSystem(fs, 4000);

// create Node.js-optimized resolver for plugins (we need the Node.js export, not browser)
const nodeResolver: Resolver = ResolverFactory.createResolver({
  fileSystem: cachedFs,
  extensions: ['.js', '.mjs', '.cjs'],
  // node condition for server-side plugins
  conditionNames: ['node', 'import', 'require', 'default'],
  mainFields: ['main', 'module'],
  exportsFields: ['exports'],
  modules: ['node_modules'],
  mainFiles: ['index'],
  symlinks: true,
  useSyncFileSystemCalls: true,
});

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

    // handle both default export and module.exports patterns
    const pluginFn =
      pluginModule.default ?? pluginModule[pluginName] ?? pluginModule;

    if (typeof pluginFn !== 'function') {
      throw new Error(
        `Plugin "${pluginName}" does not export a function. ` +
          `Got: ${typeof pluginFn}`
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
  // errors encountered during loading (plugins that failed to load)
  errors: string[];
}

// load custom plugins from MDX Preview config (only loads in Trusted Mode, returns empty arrays in Safe Mode w/ warning)
export async function loadPluginsFromConfig(
  config: ResolvedConfig | undefined,
  _documentPath: string
): Promise<LoadedPlugins> {
  const result: LoadedPlugins = {
    remarkPlugins: [],
    rehypePlugins: [],
    errors: [],
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

  // check trust state - only load plugins in Trusted Mode
  const trustManager = TrustManager.getInstance();
  const securityMode = trustManager.getMode();

  if (securityMode !== SecurityMode.Trusted) {
    const pluginCount =
      (remarkPlugins?.length ?? 0) + (rehypePlugins?.length ?? 0);
    warn(
      `Custom plugins configured but cannot load in Safe Mode. ` +
        `${pluginCount} plugin(s) will be ignored. ` +
        `Enable Trusted Mode to use custom plugins.`
    );
    return result;
  }

  const configDir = config.configDir;
  info(`Loading custom plugins from ${path.basename(config.configPath)}...`);

  // load remark plugins
  if (remarkPlugins && remarkPlugins.length > 0) {
    for (const spec of remarkPlugins) {
      try {
        const plugin = await loadPlugin(spec, configDir);
        result.remarkPlugins.push(plugin);
        debug(
          `Loaded remark plugin: ${typeof spec === 'string' ? spec : spec[0]}`
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push(message);
        warn(message);
      }
    }
  }

  // load rehype plugins
  if (rehypePlugins && rehypePlugins.length > 0) {
    for (const spec of rehypePlugins) {
      try {
        const plugin = await loadPlugin(spec, configDir);
        result.rehypePlugins.push(plugin);
        debug(
          `Loaded rehype plugin: ${typeof spec === 'string' ? spec : spec[0]}`
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push(message);
        warn(message);
      }
    }
  }

  const loadedCount = result.remarkPlugins.length + result.rehypePlugins.length;
  const errorCount = result.errors.length;

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

// result of generating component imports
export interface ComponentImportsResult {
  // import statements to prepend to MDX
  imports: string;
  // component object literal for MDX provider
  componentsObject: string;
  // whether any components were generated
  hasComponents: boolean;
}

// generate import statements & components object for custom component mapping (only generates in Trusted Mode)
export function generateComponentImports(
  config: ResolvedConfig | undefined,
  documentDir: string
): ComponentImportsResult {
  const result: ComponentImportsResult = {
    imports: '',
    componentsObject: '{}',
    hasComponents: false,
  };

  if (!config) {
    return result;
  }

  const { components } = config.config;
  if (!components || Object.keys(components).length === 0) {
    return result;
  }

  // check trust state
  const trustManager = TrustManager.getInstance();
  const securityMode = trustManager.getMode();

  if (securityMode !== SecurityMode.Trusted) {
    warn(
      `Custom components configured but cannot load in Safe Mode. ` +
        `${Object.keys(components).length} component(s) will be ignored.`
    );
    return result;
  }

  const configDir = config.configDir;
  const importStatements: string[] = [];
  const componentEntries: string[] = [];

  for (const [componentName, componentPath] of Object.entries(components)) {
    // resolve component path relative to config directory
    const absolutePath = path.isAbsolute(componentPath)
      ? componentPath
      : path.resolve(configDir, componentPath);

    // convert to relative path from document directory
    let relativePath = path.relative(documentDir, absolutePath);

    // ensure path starts with ./ for relative imports
    if (!relativePath.startsWith('.') && !relativePath.startsWith('/')) {
      relativePath = './' + relativePath;
    }

    // normalize path separators for imports
    relativePath = relativePath.replace(/\\/g, '/');

    // generate import statement using a safe variable name
    const safeVarName = `_component_${componentName.replace(/[^a-zA-Z0-9_]/g, '_')}`;
    importStatements.push(`import ${safeVarName} from '${relativePath}';`);
    componentEntries.push(`  ${componentName}: ${safeVarName}`);
  }

  if (importStatements.length > 0) {
    result.imports = importStatements.join('\n');
    result.componentsObject = `{\n${componentEntries.join(',\n')}\n}`;
    result.hasComponents = true;

    info(
      `Generated imports for ${importStatements.length} custom component(s)`
    );
    debug('Component imports:', result.imports);
  }

  return result;
}
