// packages/extension/module-system/resolver/resolver-subsystem.ts
// resolver subsystem registration for unified lifecycle management

import { ServiceRegistry } from '../../services';
import { debug } from '../../logging';
import { LogTags } from '@mdx-preview/shared';
import {
  browserResolverSingleton,
  nodeResolverSingleton,
  cachedFs,
} from './resolver-factory';
import { unifiedResolverSingleton } from './UnifiedResolver';
import { clearStatCache } from './file-prober';
import { clearCompiledIndexCache } from './strategies/TypeScriptPathStrategy';

export const RESOLVER_SUBSYSTEM = 'ResolverSubsystem';

// register the resolver subsystem w/ ServiceRegistry
// call in extension activate() AFTER service registrations
export function registerResolverSubsystem(): void {
  ServiceRegistry.getInstance().registerSubsystem(RESOLVER_SUBSYSTEM, () => {
    debug(`[${LogTags.RESOLVER_SUBSYSTEM}] Disposing resolver system...`);

    // purge cached file system (clears all file content & stat caches)
    cachedFs.purge();

    // dispose resolver singletons (clears instances)
    browserResolverSingleton.dispose();
    nodeResolverSingleton.dispose();
    unifiedResolverSingleton.dispose();

    // clear all caches
    clearStatCache();
    clearCompiledIndexCache();

    debug(`[${LogTags.RESOLVER_SUBSYSTEM}] Disposed`);
  });
}
