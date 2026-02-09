// packages/extension/module-system/resolver/resolver-subsystem.ts
// resolver subsystem registration for unified lifecycle management

import { ServiceRegistry } from '../../../app/services';
import { createTaggedLogger } from '../../../shared/logging/logger';
import { LogTags } from '@mdx-preview/shared';
import {
  browserResolverSingleton,
  nodeResolverSingleton,
  cachedFs,
} from './resolver-factory';
import { unifiedResolverSingleton } from './UnifiedResolver';
import { clearStatCache } from './file-prober';
import { clearCompiledIndexCache } from './strategies/TypeScriptPathStrategy';
import {
  clearTsConfigCache,
  disposeConfigWatchers,
} from '../../preview/configuration/TypeScriptConfigResolver';

// module-level tagged logger for resolver subsystem
const log = createTaggedLogger(LogTags.RESOLVER_SUBSYSTEM);

export const RESOLVER_SUBSYSTEM = 'ResolverSubsystem';

// register the resolver subsystem w/ ServiceRegistry
// call in extension activate() AFTER service registrations
export function registerResolverSubsystem(): void {
  ServiceRegistry.getInstance().registerSubsystem(RESOLVER_SUBSYSTEM, () => {
    log.debug('Disposing resolver system...');

    // purge cached file system (clears all file content & stat caches)
    cachedFs.purge();

    // dispose resolver singletons (clears instances)
    browserResolverSingleton.dispose();
    nodeResolverSingleton.dispose();
    unifiedResolverSingleton.dispose();

    // clear all caches
    clearStatCache();
    clearCompiledIndexCache();

    // dispose tsconfig.json watchers & clear cache
    disposeConfigWatchers();
    clearTsConfigCache();

    log.debug('Disposed');
  });
}
