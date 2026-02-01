// packages/extension/cache-subsystem.ts
// cache subsystem registration for unified lifecycle management

import { ServiceRegistry } from './services';
import { debug } from './logging';
import { LogTags } from '@mdx-preview/shared';
import { clearComponentCache } from './diagnostics/ComponentDetector';
import { clearPathSecurityCaches } from './module-system/security/checkFsPath';

export const CACHE_SUBSYSTEM = 'CacheSubsystem';

// register the cache subsystem w/ ServiceRegistry
// call in extension activate() AFTER resolver subsystem registration
export function registerCacheSubsystem(): void {
  ServiceRegistry.getInstance().registerSubsystem(CACHE_SUBSYSTEM, () => {
    debug(`[${LogTags.CACHE_SUBSYSTEM}] Disposing cache subsystem...`);

    // clear component detection cache
    clearComponentCache();

    // clear path security caches
    clearPathSecurityCaches();

    debug(`[${LogTags.CACHE_SUBSYSTEM}] Disposed`);
  });
}

// clear all unmanaged extension caches (for clearAllCaches command)
// note: managed caches (services, resolver subsystem) cleared via their own mechanisms
export function clearUnmanagedCaches(): void {
  debug(`[${LogTags.CACHE_SUBSYSTEM}] Clearing unmanaged caches...`);

  // component detection cache
  clearComponentCache();

  // path security caches
  clearPathSecurityCaches();

  debug(`[${LogTags.CACHE_SUBSYSTEM}] Unmanaged caches cleared`);
}
