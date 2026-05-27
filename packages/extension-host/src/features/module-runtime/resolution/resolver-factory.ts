// packages/extension-host/src/features/module-runtime/resolution/resolver-factory.ts
// unified resolver factory for module resolution (browser & node modes)

import * as fs from 'fs';
import { CachedInputFileSystem, ResolverFactory } from 'enhanced-resolve';
import type { Resolver } from 'enhanced-resolve';
import { createTaggedLogger } from '../../../shared/logging/logger';
import { LogTags } from '@mdx-preview/contracts';
import {
  RESOLVER_CACHE_TTL_MS,
  BROWSER_RESOLVE_EXTENSIONS,
  NODE_RESOLVE_EXTENSIONS,
} from '../../../shared/constants';
import { createResettableSingleton } from '../../../shared/utils/singleton-factory';

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
    extensions: [...BROWSER_RESOLVE_EXTENSIONS],
  },
  node: {
    // node resolution: node > import > require > default
    conditionNames: ['node', 'import', 'require', 'default'],
    mainFields: ['main', 'module'],
    aliasFields: [],
    extensions: [...NODE_RESOLVE_EXTENSIONS],
  },
};

// create a module resolver optimized for the specified mode
function createResolver(mode: ResolverMode): Resolver {
  const config = MODE_CONFIGS[mode];

  return ResolverFactory.createResolver({
    fileSystem: cachedFs,
    extensions: config.extensions,
    conditionNames: config.conditionNames,
    mainFields: config.mainFields,
    aliasFields: config.aliasFields,
    // esm exports/imports field support
    exportsFields: ['exports'],
    importsFields: mode === 'browser' ? ['imports'] : [],
    // common settings
    modules: ['node_modules'],
    mainFiles: ['index'],
    symlinks: true,
    useSyncFileSystemCalls: true,
  });
}

// pre-created resolvers for common use cases (lazily initialized)
// exported for subsystem registration (resolver-subsystem.ts)
export const browserResolverSingleton = createResettableSingleton(() =>
  createResolver('browser')
);
export const nodeResolverSingleton = createResettableSingleton(() =>
  createResolver('node')
);

// get the shared browser resolver instance (used for resolving modules to be loaded in the webview)
export const getBrowserResolver = browserResolverSingleton.get;

// get the shared node resolver instance (used for resolving plugins to be loaded in the extension)
export const getNodeResolver = nodeResolverSingleton.get;

// clear resolver cache (invalidates all cached resolutions)
// call when package.json changes or when manual refresh is requested
export function clearResolverCache(): void {
  // purge the cached file system (clears all file content & stat caches)
  cachedFs.purge();

  // reset resolver instances (forces recreation on next use)
  browserResolverSingleton.reset();
  nodeResolverSingleton.reset();

  log.debug('Cache cleared');
}
