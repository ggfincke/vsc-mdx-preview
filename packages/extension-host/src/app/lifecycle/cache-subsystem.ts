// packages/extension-host/src/app/lifecycle/cache-subsystem.ts
// authoritative extension cache invalidator registry & lifecycle cleanup

import { LogTags } from '@mdx-preview/contracts';
import { ServiceRegistry } from '../services/ServiceRegistry';
import { ServiceNames } from '../services/service-names';
import type { ConfigCache } from '../../shared/config/ConfigCache';
import type { TailwindProcessor } from '../../features/tailwind/TailwindProcessor';
import type { FrameworkDetector } from '../../features/framework/FrameworkDetector';
import type { MetaResolver } from '../../features/framework/nextra/MetaResolver';
import { createTaggedLogger } from '../../shared/logging/logger';
import { invalidateResolution } from '../../features/module-runtime/resolution/resolver-factory';
import { clearSassCache } from '../../features/module-runtime/handlers';
import { clearTsConfigCache } from '../../features/preview/configuration/TypeScriptConfigResolver';
import { clearBabelConfigCache } from '../../features/module-runtime/transform/babel';
import { clearPostCSSCache } from '../../features/tailwind/TailwindCompiler';
import { clearIconPackCache } from '../../features/themes/IconPackResolver';
import { clearComponentCache } from '../../features/diagnostics/ComponentDetector';
import { clearMdxAnalysisCache } from '../../shared/mdx-analysis/document-analysis';

const log = createTaggedLogger(LogTags.CACHE_SUBSYSTEM);

export const CACHE_SUBSYSTEM = 'CacheSubsystem';

type CacheInvalidator = () => void;

const cacheInvalidators = new Map<string, CacheInvalidator>();

// register one named cache owner for deterministic invalidation
export function registerCacheInvalidator(
  name: string,
  invalidate: CacheInvalidator
): void {
  cacheInvalidators.set(name, invalidate);
}

function registerDefaultInvalidators(): void {
  const registry = ServiceRegistry.getInstance();

  registerCacheInvalidator('resolution', invalidateResolution);
  registerCacheInvalidator('sass', clearSassCache);
  registerCacheInvalidator('components', clearComponentCache);
  registerCacheInvalidator('typescript-config', clearTsConfigCache);
  registerCacheInvalidator('babel', clearBabelConfigCache);
  registerCacheInvalidator('postcss', clearPostCSSCache);
  registerCacheInvalidator('icon-packs', clearIconPackCache);
  registerCacheInvalidator('mdx-analysis', clearMdxAnalysisCache);
  registerCacheInvalidator('preview-config', () => {
    registry.getIfInitialized<ConfigCache>(ServiceNames.CONFIG_CACHE)?.clear();
  });
  registerCacheInvalidator('tailwind', () => {
    registry
      .getIfInitialized<TailwindProcessor>(ServiceNames.TAILWIND_PROCESSOR)
      ?.clearCaches();
  });
  registerCacheInvalidator('framework', () => {
    registry
      .getIfInitialized<FrameworkDetector>(ServiceNames.FRAMEWORK_DETECTOR)
      ?.clearCaches();
  });
  registerCacheInvalidator('nextra-meta', () => {
    registry
      .getIfInitialized<MetaResolver>(ServiceNames.META_RESOLVER)
      ?.clearCaches();
  });
}

// register the cache subsystem w/ ServiceRegistry
// call in extension activate() AFTER resolver subsystem registration
export function registerCacheSubsystem(): void {
  registerDefaultInvalidators();

  ServiceRegistry.getInstance().registerSubsystem(CACHE_SUBSYSTEM, () => {
    log.debug('Disposing cache subsystem...');
    clearExtensionCaches();
    cacheInvalidators.clear();
    log.debug('Disposed');
  });
}

// clear every registered extension cache
export function clearExtensionCaches(): void {
  log.debug('Clearing extension caches...');
  for (const invalidate of cacheInvalidators.values()) {
    invalidate();
  }
  log.debug('Extension caches cleared');
}
