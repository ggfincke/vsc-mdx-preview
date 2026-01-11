// packages/extension/module-fetcher/resolver-factory.ts
// Unified resolver factory for module resolution (browser & node modes)

import * as fs from 'fs';
import { CachedInputFileSystem, ResolverFactory } from 'enhanced-resolve';
import type { Resolver } from 'enhanced-resolve';

// shared cached file system for all resolvers (4 second cache)
const cachedFs = new CachedInputFileSystem(fs, 4000);

// resolver mode determines the resolution strategy
// - 'browser': prioritizes browser-compatible exports for webview module loading
// - 'node': prioritizes Node.js exports for extension-side plugin loading
export type ResolverMode = 'browser' | 'node';

// Mode-specific configuration
interface ModeConfig {
  conditionNames: string[];
  mainFields: string[];
  aliasFields: string[];
  extensions: string[];
}

const MODE_CONFIGS: Record<ResolverMode, ModeConfig> = {
  browser: {
    // browser resolution: browser > import > require > default
    conditionNames: ['browser', 'import', 'require', 'default'],
    mainFields: ['browser', 'module', 'main'],
    // support browser field aliasing
    aliasFields: ['browser'],
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json'],
  },
  node: {
    // node resolution: node > import > require > default
    conditionNames: ['node', 'import', 'require', 'default'],
    mainFields: ['main', 'module'],
    aliasFields: [],
    extensions: ['.js', '.mjs', '.cjs'],
  },
};

// create a module resolver optimized for the specified mode
// - 'browser' for webview module loading (browser conditions)
// - 'node' for plugin loading (node conditions)
export function createResolver(mode: ResolverMode): Resolver {
  const config = MODE_CONFIGS[mode];

  return ResolverFactory.createResolver({
    fileSystem: cachedFs,
    extensions: config.extensions,
    conditionNames: config.conditionNames,
    mainFields: config.mainFields,
    aliasFields: config.aliasFields,
    // ESM exports/imports field support
    exportsFields: ['exports'],
    importsFields: mode === 'browser' ? ['imports'] : [],
    // Common settings
    modules: ['node_modules'],
    mainFiles: ['index'],
    symlinks: true,
    useSyncFileSystemCalls: true,
  });
}

// pre-created resolvers for common use cases (lazily initialized)
let _browserResolver: Resolver | null = null;
let _nodeResolver: Resolver | null = null;

// get the shared browser resolver instance (used for resolving modules to be loaded in the webview)
export function getBrowserResolver(): Resolver {
  if (!_browserResolver) {
    _browserResolver = createResolver('browser');
  }
  return _browserResolver;
}

// get the shared node resolver instance (used for resolving plugins to be loaded in the extension)
export function getNodeResolver(): Resolver {
  if (!_nodeResolver) {
    _nodeResolver = createResolver('node');
  }
  return _nodeResolver;
}

// Export cached filesystem for handlers that need SASS compilation
export { cachedFs };
