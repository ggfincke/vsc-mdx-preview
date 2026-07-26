// packages/extension-host/src/features/module-runtime/resolution/resolver-factory.ts
// unified resolver factory for module resolution (browser & node modes)

import * as fs from 'fs';
import { CachedInputFileSystem, ResolverFactory } from 'enhanced-resolve';
import type { Resolver } from 'enhanced-resolve';
import { createTaggedLogger } from '../../../shared/logging/logger';
import { LogTags, type ModuleDependencyKind } from '@mdx-preview/contracts';
import {
  RESOLVER_CACHE_TTL_MS,
  BROWSER_RESOLVE_EXTENSIONS,
  NODE_RESOLVE_EXTENSIONS,
} from '../../../shared/constants';
import { createResettableSingleton } from '../../../shared/utils/singleton-factory';
import { clearPathSecurityCaches } from '../security/checkFsPath';
import { clearStatCache } from './file-prober';
import { clearCompiledIndexCache } from './strategies/TypeScriptPathStrategy';

// module-level tagged logger for resolver factory
const log = createTaggedLogger(LogTags.RESOLVER);

// shared cached file system for all resolvers
// exported for subsystem disposal (resolver-subsystem.ts)
// cast: @types/node 25 fs type no longer matches enhanced-resolve BaseFileSystem (runtime-safe)
export const cachedFs = new CachedInputFileSystem(
  fs as unknown as ConstructorParameters<typeof CachedInputFileSystem>[0],
  RESOLVER_CACHE_TTL_MS
);

// resolver mode determines the resolution strategy
type ResolverMode = 'browser' | 'node';

// mode-specific configuration
interface ModeConfig {
  mainFields: string[];
  aliasFields: string[];
  extensions: string[];
}

const MODE_CONFIGS: Record<ResolverMode, ModeConfig> = {
  browser: {
    mainFields: ['browser', 'module', 'main'],
    // support browser field aliasing
    aliasFields: ['browser'],
    extensions: [...BROWSER_RESOLVE_EXTENSIONS],
  },
  node: {
    mainFields: ['main', 'module'],
    aliasFields: [],
    extensions: [...NODE_RESOLVE_EXTENSIONS],
  },
};

// create a module resolver for one mode & filesystem call style
function createResolver(
  mode: ResolverMode,
  dependencyKind: ModuleDependencyKind,
  useSyncFileSystemCalls: boolean
): Resolver {
  const config = MODE_CONFIGS[mode];

  return ResolverFactory.createResolver({
    fileSystem: cachedFs,
    extensions: config.extensions,
    conditionNames: [mode, dependencyKind, 'default'],
    mainFields: config.mainFields,
    aliasFields: config.aliasFields,
    // esm exports/imports field support
    exportsFields: ['exports'],
    importsFields: mode === 'browser' ? ['imports'] : [],
    // common settings
    modules: ['node_modules'],
    mainFiles: ['index'],
    symlinks: true,
    useSyncFileSystemCalls,
  });
}

// sync & async resolver instances for one condition mode
interface ModeResolvers {
  import: ResolverPair;
  require: ResolverPair;
}

interface ResolverPair {
  sync: Resolver;
  async: Resolver;
}

// create paired resolvers so async callers never route through sync fs adapters
function createModeResolvers(mode: ResolverMode): ModeResolvers {
  return {
    import: {
      sync: createResolver(mode, 'import', true),
      async: createResolver(mode, 'import', false),
    },
    require: {
      sync: createResolver(mode, 'require', true),
      async: createResolver(mode, 'require', false),
    },
  };
}

// lazily initialize mode-specific sync & async resolvers
// exported for subsystem registration (resolver-subsystem.ts)
export const browserResolverSingleton = createResettableSingleton(() =>
  createModeResolvers('browser')
);
export const nodeResolverSingleton = createResettableSingleton(() =>
  createModeResolvers('node')
);

// get the shared browser resolver instance (used for resolving modules to be loaded in the webview)
export const getBrowserResolver = (
  dependencyKind: ModuleDependencyKind = 'require'
): Resolver => browserResolverSingleton.get()[dependencyKind].sync;

// get the shared node resolver instance (used for resolving plugins to be loaded in the extension)
export const getNodeResolver = (
  dependencyKind: ModuleDependencyKind = 'require'
): Resolver => nodeResolverSingleton.get()[dependencyKind].sync;

// get async browser resolver for the module fetch hot path
export const getAsyncBrowserResolver = (
  dependencyKind: ModuleDependencyKind = 'require'
): Resolver => browserResolverSingleton.get()[dependencyKind].async;

// get async node resolver for async plugin resolution
export const getAsyncNodeResolver = (
  dependencyKind: ModuleDependencyKind = 'require'
): Resolver => nodeResolverSingleton.get()[dependencyKind].async;

// clear enhanced-resolve fs + resolver singletons only
// does NOT clear statCache or compiledIndexCache; use invalidateResolution() for full invalidation
export function clearResolverCache(): void {
  // purge the cached file system (clears enhanced-resolve file content & stat caches)
  cachedFs.purge();

  // reset resolver instances (forces recreation on next use)
  browserResolverSingleton.reset();
  nodeResolverSingleton.reset();

  log.debug('Resolver cache cleared');
}

// full resolution invalidation across every resolution cache
// call when package.json/tsconfig changes or when manual refresh is requested
// clears enhanced-resolve fs + resolver singletons + statCache + compiledIndexCache
export function invalidateResolution(): void {
  clearResolverCache();
  clearStatCache();
  clearCompiledIndexCache();
  clearPathSecurityCaches();

  log.debug('Resolution fully invalidated');
}
