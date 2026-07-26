// tests/services/ServiceRegistry.subsystem.test.ts
// Unit tests for ServiceRegistry subsystem registration

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { cacheInvalidators } = vi.hoisted(() => ({
  cacheInvalidators: {
    babel: vi.fn(),
    components: vi.fn(),
    framework: vi.fn(),
    iconPacks: vi.fn(),
    mdxAnalysis: vi.fn(),
    nextraMeta: vi.fn(),
    postcss: vi.fn(),
    resolution: vi.fn(),
    sass: vi.fn(),
    tailwind: vi.fn(),
    tsConfig: vi.fn(),
    previewConfig: vi.fn(),
  },
}));

// Mock vscode module
vi.mock('vscode', () => ({}));
vi.mock(
  '../../packages/extension-host/src/features/module-runtime/resolution/resolver-factory',
  () => ({ invalidateResolution: cacheInvalidators.resolution })
);
vi.mock(
  '../../packages/extension-host/src/features/module-runtime/handlers',
  () => ({ clearSassCache: cacheInvalidators.sass })
);
vi.mock(
  '../../packages/extension-host/src/features/preview/configuration/TypeScriptConfigResolver',
  () => ({ clearTsConfigCache: cacheInvalidators.tsConfig })
);
vi.mock(
  '../../packages/extension-host/src/features/module-runtime/transform/babel',
  () => ({ clearBabelConfigCache: cacheInvalidators.babel })
);
vi.mock(
  '../../packages/extension-host/src/features/tailwind/TailwindCompiler',
  () => ({ clearPostCSSCache: cacheInvalidators.postcss })
);
vi.mock(
  '../../packages/extension-host/src/features/themes/IconPackResolver',
  () => ({ clearIconPackCache: cacheInvalidators.iconPacks })
);
vi.mock(
  '../../packages/extension-host/src/features/diagnostics/ComponentDetector',
  () => ({ clearComponentCache: cacheInvalidators.components })
);
vi.mock(
  '../../packages/extension-host/src/shared/mdx-analysis/document-analysis',
  () => ({ clearMdxAnalysisCache: cacheInvalidators.mdxAnalysis })
);

// Import after mocks
import { ServiceRegistry } from '../../packages/extension-host/src/app/services/ServiceRegistry';
import { ServiceNames } from '../../packages/extension-host/src/app/services/service-names';
import {
  clearExtensionCaches,
  registerCacheSubsystem,
} from '../../packages/extension-host/src/app/lifecycle/cache-subsystem';

describe('ServiceRegistry subsystem registration', () => {
  let registry: ServiceRegistry;

  beforeEach(() => {
    ServiceRegistry.reset();
    registry = ServiceRegistry.getInstance();
  });

  afterEach(() => {
    ServiceRegistry.reset();
    vi.clearAllMocks();
  });

  describe('registerSubsystem', () => {
    it('should register a subsystem', () => {
      const disposeFn = vi.fn();
      const configFactory = vi.fn(() => ({
        clear: cacheInvalidators.previewConfig,
        dispose: vi.fn(),
      }));
      const tailwindFactory = vi.fn(() => ({
        clearCaches: cacheInvalidators.tailwind,
        dispose: vi.fn(),
      }));
      const frameworkFactory = vi.fn(() => ({
        clearCaches: cacheInvalidators.framework,
        dispose: vi.fn(),
      }));
      const metaFactory = vi.fn(() => ({
        clearCaches: cacheInvalidators.nextraMeta,
        dispose: vi.fn(),
      }));
      registry.registerSubsystem('TestSubsystem', disposeFn);
      registry.register(ServiceNames.CONFIG_CACHE, configFactory);
      registry.register(ServiceNames.TAILWIND_PROCESSOR, tailwindFactory);
      registry.register(ServiceNames.FRAMEWORK_DETECTOR, frameworkFactory);
      registry.register(ServiceNames.META_RESOLVER, metaFactory);
      registerCacheSubsystem();

      clearExtensionCaches();
      expect(cacheInvalidators.resolution).toHaveBeenCalledOnce();
      expect(cacheInvalidators.sass).toHaveBeenCalledOnce();
      expect(cacheInvalidators.components).toHaveBeenCalledOnce();
      expect(cacheInvalidators.tsConfig).toHaveBeenCalledOnce();
      expect(cacheInvalidators.babel).toHaveBeenCalledOnce();
      expect(cacheInvalidators.postcss).toHaveBeenCalledOnce();
      expect(cacheInvalidators.iconPacks).toHaveBeenCalledOnce();
      expect(cacheInvalidators.mdxAnalysis).toHaveBeenCalledOnce();
      expect(configFactory).not.toHaveBeenCalled();
      expect(tailwindFactory).not.toHaveBeenCalled();
      expect(frameworkFactory).not.toHaveBeenCalled();
      expect(metaFactory).not.toHaveBeenCalled();

      registry.get(ServiceNames.CONFIG_CACHE);
      registry.get(ServiceNames.TAILWIND_PROCESSOR);
      registry.get(ServiceNames.FRAMEWORK_DETECTOR);
      registry.get(ServiceNames.META_RESOLVER);
      clearExtensionCaches();

      expect(cacheInvalidators.previewConfig).toHaveBeenCalledOnce();
      expect(cacheInvalidators.tailwind).toHaveBeenCalledOnce();
      expect(cacheInvalidators.framework).toHaveBeenCalledOnce();
      expect(cacheInvalidators.nextraMeta).toHaveBeenCalledOnce();

      // Disposing the registry should call the subsystem's dispose function
      registry.dispose();
      expect(disposeFn).toHaveBeenCalledOnce();
    });
  });

  describe('disposal order', () => {
    it('should dispose subsystems in reverse registration order', () => {
      const disposalOrder: string[] = [];

      registry.registerSubsystem('First', () => {
        disposalOrder.push('First');
      });
      registry.registerSubsystem('Second', () => {
        disposalOrder.push('Second');
      });
      registry.registerSubsystem('Third', () => {
        disposalOrder.push('Third');
      });

      registry.dispose();

      // should be disposed in reverse order: Third, Second, First
      expect(disposalOrder).toEqual(['Third', 'Second', 'First']);
    });

    it('should dispose subsystems BEFORE services', () => {
      const disposalOrder: string[] = [];

      // register a service first
      registry.register('ServiceA', () => ({
        dispose: () => {
          disposalOrder.push('ServiceA');
        },
      }));

      // register a subsystem
      registry.registerSubsystem('SubsystemA', () => {
        disposalOrder.push('SubsystemA');
      });

      // register another service
      registry.register('ServiceB', () => ({
        dispose: () => {
          disposalOrder.push('ServiceB');
        },
      }));

      // initialize services
      registry.get('ServiceA');
      registry.get('ServiceB');

      registry.dispose();

      // subsystems should be disposed first, then services (both in reverse order)
      expect(disposalOrder).toEqual(['SubsystemA', 'ServiceB', 'ServiceA']);
    });
  });

  describe('error handling', () => {
    it('should continue disposing other subsystems after one throws', () => {
      const disposalOrder: string[] = [];

      registry.registerSubsystem('First', () => {
        disposalOrder.push('First');
      });
      registry.registerSubsystem('ThrowingSubsystem', () => {
        disposalOrder.push('Throwing');
        throw new Error('Subsystem error');
      });
      registry.registerSubsystem('Third', () => {
        disposalOrder.push('Third');
      });

      // should not throw, but should continue disposing
      expect(() => registry.dispose()).not.toThrow();

      // all subsystems should have been called (reverse order)
      expect(disposalOrder).toEqual(['Third', 'Throwing', 'First']);
    });
  });
});
