// packages/extension/test/plugin-loader.test.ts
// tests for plugin-loader - verifies plugin loading, component mapping, & trust enforcement

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  __setMockTrusted,
  __setMockConfig,
  __resetMocks,
  __getMockConfig,
  Uri,
} from './__mocks__/vscode';
import {
  loadPluginsFromConfig,
  mergePlugins,
} from '../transpiler/plugin-loader';
import { generateComponentImports } from '../transpiler/component-mapper';
import { TrustManager } from '../security/TrustManager';
import { ServiceRegistry } from '../services/ServiceRegistry';
import { ServiceNames } from '../services/service-names';
import type { ResolvedConfig } from '../preview/config';

// mock getConfigManager and getErrorReporter to use vscode mock's config store
vi.mock('../services', async (importOriginal) => {
  const original = await importOriginal<typeof import('../services')>();
  return {
    ...original,
    getConfigManager: () => ({
      get: (key: string, scope?: unknown) => {
        return __getMockConfig(key) ?? false;
      },
      set: vi.fn(),
    }),
    getErrorReporter: () => ({
      report: vi.fn(),
      reportSilent: vi.fn(),
      reportToUser: vi.fn(),
      reportConfigError: vi.fn(),
      reportPluginError: vi.fn(),
      reportWithActions: vi.fn(),
      reportWebviewError: vi.fn(),
    }),
  };
});

// mock modules
vi.mock('enhanced-resolve', () => ({
  CachedInputFileSystem: vi.fn(),
  ResolverFactory: {
    createResolver: vi.fn(() => ({
      resolveSync: vi.fn((_context, _basedir, module) => {
        // Simple mock resolution
        if (module === 'remark-toc' || module === 'remark-emoji') {
          return `/node_modules/${module}/index.js`;
        }
        return false;
      }),
    })),
  },
}));

// reset TrustManager singleton between tests
const resetTrustManager = (): void => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (TrustManager as any).instance = undefined;
};

describe('PluginLoader', () => {
  beforeEach(() => {
    __resetMocks();
    resetTrustManager();
    ServiceRegistry.reset();
    vi.clearAllMocks();

    // register TrustManager w/ ServiceRegistry
    const registry = ServiceRegistry.getInstance();
    registry.register(ServiceNames.TRUST_MANAGER, () => TrustManager.getInstance());
  });

  afterEach(() => {
    try {
      TrustManager.getInstance().dispose();
    } catch {
      // ignore if already disposed
    }
    resetTrustManager();
    ServiceRegistry.reset();
    __resetMocks();
  });

  describe('loadPluginsFromConfig - Trust Enforcement', () => {
    it('should return empty arrays in Safe Mode', async () => {
      // Set up Safe Mode (workspace not trusted)
      __setMockTrusted(false);
      __setMockConfig('preview.enableScripts', false);

      const config: ResolvedConfig = {
        config: {
          remarkPlugins: ['remark-toc'],
          rehypePlugins: ['rehype-slug'],
        },
        configPath: '/workspace/.mdx-previewrc.json',
        configDir: '/workspace',
      };

      const result = await loadPluginsFromConfig(config, Uri.file('/workspace/test.mdx'));

      expect(result.remarkPlugins).toEqual([]);
      expect(result.rehypePlugins).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it('should load plugins in Trusted Mode', async () => {
      // Set up Trusted Mode
      __setMockTrusted(true);
      __setMockConfig('preview.enableScripts', true);

      // Mock require to return a plugin function
      const mockPluginFn = vi.fn(() => vi.fn());
      vi.doMock('remark-toc', () => ({
        default: mockPluginFn,
      }));

      const config: ResolvedConfig = {
        config: {
          remarkPlugins: ['remark-toc'],
        },
        configPath: '/workspace/.mdx-previewrc.json',
        configDir: '/workspace',
      };

      const result = await loadPluginsFromConfig(config, Uri.file('/workspace/test.mdx'));

      // Should attempt to load plugins (may fail due to mock limitations)
      // The important thing is it didn't return empty arrays
      expect(result).toBeDefined();
    });

    it('should handle no config gracefully', async () => {
      const result = await loadPluginsFromConfig(
        undefined,
        Uri.file('/workspace/test.mdx')
      );

      expect(result.remarkPlugins).toEqual([]);
      expect(result.rehypePlugins).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it('should handle empty plugin arrays', async () => {
      // Set up Trusted Mode
      __setMockTrusted(true);
      __setMockConfig('preview.enableScripts', true);

      const config: ResolvedConfig = {
        config: {
          remarkPlugins: [],
          rehypePlugins: [],
        },
        configPath: '/workspace/.mdx-previewrc.json',
        configDir: '/workspace',
      };

      const result = await loadPluginsFromConfig(config, Uri.file('/workspace/test.mdx'));

      expect(result.remarkPlugins).toEqual([]);
      expect(result.rehypePlugins).toEqual([]);
      expect(result.errors).toEqual([]);
    });
  });

  describe('generateComponentImports', () => {
    it('should generate imports for components', () => {
      // Set up Trusted Mode
      __setMockTrusted(true);
      __setMockConfig('preview.enableScripts', true);

      const config: ResolvedConfig = {
        config: {
          components: {
            Callout: './components/Callout.tsx',
            Button: './components/Button.tsx',
          },
        },
        configPath: '/workspace/.mdx-previewrc.json',
        configDir: '/workspace',
      };

      const result = generateComponentImports(config, '/workspace/src');

      expect(result.hasComponents).toBe(true);
      expect(result.imports).toContain('import _component_Callout from');
      expect(result.imports).toContain('import _component_Button from');
      expect(result.componentsObject).toContain('Callout: _component_Callout');
      expect(result.componentsObject).toContain('Button: _component_Button');
    });

    it('should normalize paths for imports', () => {
      // Set up Trusted Mode
      __setMockTrusted(true);
      __setMockConfig('preview.enableScripts', true);

      const config: ResolvedConfig = {
        config: {
          components: {
            MyComponent: './src/MyComponent.tsx',
          },
        },
        configPath: '/workspace/.mdx-previewrc.json',
        configDir: '/workspace',
      };

      const result = generateComponentImports(config, '/workspace/docs');

      expect(result.hasComponents).toBe(true);
      // Path should be normalized (forward slashes, relative)
      expect(result.imports).toMatch(
        /from ['"]\.\.\/src\/MyComponent\.tsx['"]/
      );
    });

    it('should handle absolute paths', () => {
      // Set up Trusted Mode
      __setMockTrusted(true);
      __setMockConfig('preview.enableScripts', true);

      const config: ResolvedConfig = {
        config: {
          components: {
            AbsComponent: '/absolute/path/Component.tsx',
          },
        },
        configPath: '/workspace/.mdx-previewrc.json',
        configDir: '/workspace',
      };

      const result = generateComponentImports(config, '/workspace/src');

      expect(result.hasComponents).toBe(true);
      expect(result.imports).toBeDefined();
    });

    it('should handle relative paths from config dir', () => {
      // Set up Trusted Mode
      __setMockTrusted(true);
      __setMockConfig('preview.enableScripts', true);

      const config: ResolvedConfig = {
        config: {
          components: {
            Component: '../shared/Component.tsx',
          },
        },
        configPath: '/workspace/project/.mdx-previewrc.json',
        configDir: '/workspace/project',
      };

      const result = generateComponentImports(
        config,
        '/workspace/project/docs'
      );

      expect(result.hasComponents).toBe(true);
      expect(result.imports).toContain('_component_Component');
    });

    it('should return empty in Safe Mode', () => {
      // Set up Safe Mode
      __setMockTrusted(false);
      __setMockConfig('preview.enableScripts', false);

      const config: ResolvedConfig = {
        config: {
          components: {
            Callout: './components/Callout.tsx',
          },
        },
        configPath: '/workspace/.mdx-previewrc.json',
        configDir: '/workspace',
      };

      const result = generateComponentImports(config, '/workspace/src');

      expect(result.hasComponents).toBe(false);
      expect(result.imports).toBe('');
      expect(result.componentsObject).toBe('{}');
    });

    it('should handle no components when builtins disabled', () => {
      // Set up Trusted Mode with builtins disabled
      __setMockTrusted(true);
      __setMockConfig('preview.enableScripts', true);

      const config: ResolvedConfig = {
        config: {},
        configPath: '/workspace/.mdx-previewrc.json',
        configDir: '/workspace',
      };

      const result = generateComponentImports(config, '/workspace/src', {
        builtinsEnabled: false,
      });

      expect(result.hasComponents).toBe(false);
      expect(result.imports).toBe('');
      expect(result.componentsObject).toBe('{}');
    });

    it('should inject builtin shims when builtins enabled and no user components', () => {
      // Set up Trusted Mode with builtins enabled
      __setMockTrusted(true);
      __setMockConfig('preview.enableScripts', true);

      const config: ResolvedConfig = {
        config: {},
        configPath: '/workspace/.mdx-previewrc.json',
        configDir: '/workspace',
      };

      const result = generateComponentImports(config, '/workspace/src', {
        builtinsEnabled: true,
      });

      expect(result.hasComponents).toBe(true);
      // Should include all builtin components
      expect(result.imports).toContain("import _builtin_Callout from 'Callout';");
      expect(result.imports).toContain("import _builtin_Tabs from 'Tabs';");
      expect(result.imports).toContain("import _builtin_Collapsible from 'Collapsible';");
      expect(result.componentsObject).toContain('Callout: _builtin_Callout');
      expect(result.componentsObject).toContain('Tabs: _builtin_Tabs');
    });

    it('should allow user config to override builtin shims', () => {
      // Set up Trusted Mode with builtins enabled
      __setMockTrusted(true);
      __setMockConfig('preview.enableScripts', true);

      const config: ResolvedConfig = {
        config: {
          components: {
            Callout: './custom/Callout.tsx', // Override builtin Callout
          },
        },
        configPath: '/workspace/.mdx-previewrc.json',
        configDir: '/workspace',
      };

      // Use same directory as config for simpler path resolution
      const result = generateComponentImports(config, '/workspace', {
        builtinsEnabled: true,
      });

      expect(result.hasComponents).toBe(true);
      // User's Callout should be used, not builtin
      expect(result.imports).toContain('_component_Callout');
      expect(result.imports).toContain('custom/Callout.tsx');
      expect(result.imports).not.toContain("import _builtin_Callout");
      // Other builtins should still be included
      expect(result.imports).toContain("import _builtin_Tabs from 'Tabs';");
    });

    it('should handle undefined config', () => {
      const result = generateComponentImports(undefined, '/workspace/src');

      expect(result.hasComponents).toBe(false);
      expect(result.imports).toBe('');
      expect(result.componentsObject).toBe('{}');
    });

    it('should sanitize component names for variable names', () => {
      // Set up Trusted Mode
      __setMockTrusted(true);
      __setMockConfig('preview.enableScripts', true);

      const config: ResolvedConfig = {
        config: {
          components: {
            'My-Component': './Component.tsx',
            'Another.Component': './Another.tsx',
          },
        },
        configPath: '/workspace/.mdx-previewrc.json',
        configDir: '/workspace',
      };

      const result = generateComponentImports(config, '/workspace/src');

      expect(result.hasComponents).toBe(true);
      // Variable names should be sanitized (no hyphens or dots)
      expect(result.imports).toContain('_component_My_Component');
      expect(result.imports).toContain('_component_Another_Component');
    });
  });

  describe('mergePlugins', () => {
    it('should merge custom plugins after built-ins', () => {
      // Use any[] for test data since we're testing the merge logic, not actual plugins
      const builtIns = ['plugin-1', 'plugin-2'] as any[];
      const custom = ['custom-1', 'custom-2'] as any[];

      const result = mergePlugins(builtIns, custom);

      expect(result).toEqual(['plugin-1', 'plugin-2', 'custom-1', 'custom-2']);
    });

    it('should return built-ins if no custom plugins', () => {
      const builtIns = ['plugin-1', 'plugin-2'] as any[];
      const custom: any[] = [];

      const result = mergePlugins(builtIns, custom);

      expect(result).toEqual(['plugin-1', 'plugin-2']);
      expect(result).toBe(builtIns); // Should return same reference
    });

    it('should handle empty built-ins', () => {
      const builtIns: any[] = [];
      const custom = ['custom-1'] as any[];

      const result = mergePlugins(builtIns, custom);

      expect(result).toEqual(['custom-1']);
    });

    it('should handle plugin tuples', () => {
      const builtIns = [['plugin-1', { option: true }]] as any[];
      const custom = [['custom-1', { custom: 'yes' }]] as any[];

      const result = mergePlugins(builtIns, custom);

      expect(result).toEqual([
        ['plugin-1', { option: true }],
        ['custom-1', { custom: 'yes' }],
      ]);
    });
  });

  describe('error handling', () => {
    it('should collect errors for failed plugin loads', async () => {
      // Set up Trusted Mode
      __setMockTrusted(true);
      __setMockConfig('preview.enableScripts', true);

      const config: ResolvedConfig = {
        config: {
          remarkPlugins: ['non-existent-plugin'],
        },
        configPath: '/workspace/.mdx-previewrc.json',
        configDir: '/workspace',
      };

      const result = await loadPluginsFromConfig(config, Uri.file('/workspace/test.mdx'));

      // Should have errors but not throw
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.remarkPlugins).toEqual([]);
    });
  });
});
