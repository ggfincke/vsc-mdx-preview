// packages/extension/cache-subsystem.ts
// cache subsystem registration for unified lifecycle management

import { ServiceRegistry } from './services';
import { createTaggedLogger } from './logging';
import { LogTags } from '@mdx-preview/shared';

const log = createTaggedLogger(LogTags.CACHE_SUBSYSTEM);
import { clearComponentCache } from './diagnostics/ComponentDetector';
import { clearPathSecurityCaches } from './module-system/security/checkFsPath';

export const CACHE_SUBSYSTEM = 'CacheSubsystem';

// register the cache subsystem w/ ServiceRegistry
// call in extension activate() AFTER resolver subsystem registration
export function registerCacheSubsystem(): void {
  ServiceRegistry.getInstance().registerSubsystem(CACHE_SUBSYSTEM, () => {
    log.debug('Disposing cache subsystem...');

    // clear component detection cache
    clearComponentCache();

    // clear path security caches
    clearPathSecurityCaches();

    log.debug('Disposed');
  });
}

// clear all unmanaged extension caches (for clearAllCaches command)
// note: managed caches (services, resolver subsystem) cleared via their own mechanisms
export function clearUnmanagedCaches(): void {
  log.debug('Clearing unmanaged caches...');

  // component detection cache
  clearComponentCache();

  // path security caches
  clearPathSecurityCaches();

  log.debug('Unmanaged caches cleared');
}
