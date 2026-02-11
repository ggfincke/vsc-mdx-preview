// tests/resolution/unified-resolver.test.ts
// Unit tests for UnifiedResolver module resolution

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode
vi.mock('vscode', () => ({}));

// Mock strategies for controlled testing
const mockTypeScriptStrategy = {
  name: 'TypeScript',
  resolve: vi.fn(),
  resolveAsync: vi.fn(),
};
const mockEnhancedResolveStrategy = {
  name: 'EnhancedResolve',
  resolve: vi.fn(),
};
const mockFileProbeStrategy = {
  name: 'FileProbe',
  resolve: vi.fn(),
  resolveAsync: vi.fn(),
};

vi.mock(
  '../../packages/extension-host/src/features/module-runtime/resolution/strategies',
  () => ({
    getTypeScriptPathStrategy: () => mockTypeScriptStrategy,
    getEnhancedResolveStrategy: () => mockEnhancedResolveStrategy,
    getFileProbeStrategy: () => mockFileProbeStrategy,
  })
);

// Import after mocks
import {
  UnifiedResolver,
  getUnifiedResolver,
  resetUnifiedResolver,
  resolveFrameworkAliasStep,
} from '../../packages/extension-host/src/features/module-runtime/resolution/UnifiedResolver';
import { ResolutionStrategy } from '../../packages/extension-host/src/types';

describe('UnifiedResolver', () => {
  let resolver: UnifiedResolver;

  beforeEach(() => {
    vi.clearAllMocks();
    resetUnifiedResolver();
    resolver = getUnifiedResolver();

    // Reset all strategy mocks
    mockTypeScriptStrategy.resolve.mockReturnValue(null);
    mockTypeScriptStrategy.resolveAsync.mockResolvedValue(null);
    mockEnhancedResolveStrategy.resolve.mockReturnValue(null);
    mockFileProbeStrategy.resolve.mockReturnValue(null);
    mockFileProbeStrategy.resolveAsync.mockResolvedValue(null);
  });

  describe('shouldResolve()', () => {
    it('returns false for empty string', () => {
      expect(resolver.shouldResolve('')).toBe(false);
    });

    it('returns false for HTTP URLs', () => {
      expect(resolver.shouldResolve('http://example.com/module.js')).toBe(
        false
      );
    });

    it('returns false for HTTPS URLs', () => {
      expect(resolver.shouldResolve('https://example.com/module.js')).toBe(
        false
      );
    });

    it('returns false for npm:// protocol (preloaded modules)', () => {
      expect(resolver.shouldResolve('npm://react')).toBe(false);
      expect(resolver.shouldResolve('npm://@mdx-preview/shims/Callout')).toBe(
        false
      );
    });

    it('returns true for relative imports', () => {
      expect(resolver.shouldResolve('./Button')).toBe(true);
      expect(resolver.shouldResolve('../components/Card')).toBe(true);
    });

    it('returns true for bare imports (node_modules)', () => {
      expect(resolver.shouldResolve('react')).toBe(true);
      expect(resolver.shouldResolve('lodash/debounce')).toBe(true);
      expect(resolver.shouldResolve('@emotion/react')).toBe(true);
    });
  });

  describe('isRelativeImport()', () => {
    it('returns true for ./ imports', () => {
      expect(resolver.isRelativeImport('./Button')).toBe(true);
      expect(resolver.isRelativeImport('./components/Card')).toBe(true);
    });

    it('returns true for ../ imports', () => {
      expect(resolver.isRelativeImport('../utils')).toBe(true);
      expect(resolver.isRelativeImport('../../shared/types')).toBe(true);
    });

    it('returns false for bare imports', () => {
      expect(resolver.isRelativeImport('react')).toBe(false);
      expect(resolver.isRelativeImport('@emotion/react')).toBe(false);
      expect(resolver.isRelativeImport('lodash')).toBe(false);
    });

    it('returns false for absolute paths', () => {
      expect(resolver.isRelativeImport('/absolute/path')).toBe(false);
    });
  });

  describe('resolveSync()', () => {
    it('returns null for HTTP URLs', () => {
      const context = { baseDir: '/workspace' };
      const result = resolver.resolveSync(
        'https://cdn.example.com/lib.js',
        context
      );

      expect(result).toBeNull();
    });

    it('returns null for npm:// protocol', () => {
      const context = { baseDir: '/workspace' };
      const result = resolver.resolveSync('npm://react', context);

      expect(result).toBeNull();
    });

    it('resolves framework alias to built-in shim when shims enabled', () => {
      const context = {
        baseDir: '/workspace/docs',
        workspaceRoot: '/workspace',
        framework: 'docusaurus' as const,
        shimsEnabled: true,
      };

      const result = resolver.resolveSync('@theme/Tabs', context);

      // Should resolve to a built-in shim path
      expect(result).not.toBeNull();
      if (result) {
        expect(result.isBuiltInShim).toBe(true);
        expect(result.fsPath).toContain('@mdx-preview/shims');
      }
    });

    it('returns null for framework alias when shims disabled', () => {
      const context = {
        baseDir: '/workspace/docs',
        workspaceRoot: '/workspace',
        framework: 'docusaurus' as const,
        shimsEnabled: false,
      };

      // Without shims, @theme/Tabs won't resolve to anything
      const result = resolver.resolveSync('@theme/Tabs', context);

      // Either null or not a shim
      if (result) {
        expect(result.isBuiltInShim).not.toBe(true);
      }
    });
  });

  describe('singleton behavior', () => {
    it('returns same instance on repeated calls', () => {
      const instance1 = getUnifiedResolver();
      const instance2 = getUnifiedResolver();

      expect(instance1).toBe(instance2);
    });

    it('returns new instance after reset', () => {
      const instance1 = getUnifiedResolver();
      resetUnifiedResolver();
      const instance2 = getUnifiedResolver();

      expect(instance1).not.toBe(instance2);
    });
  });

  // asynchronous resolution (resolveAsync)
  describe('resolveAsync()', () => {
    it('returns null for HTTP URLs', async () => {
      const context = { baseDir: '/workspace' };
      const result = await resolver.resolveAsync(
        'https://cdn.example.com/lib.js',
        context
      );

      expect(result).toBeNull();
    });

    it('returns null for npm:// protocol', async () => {
      const context = { baseDir: '/workspace' };
      const result = await resolver.resolveAsync('npm://react', context);

      expect(result).toBeNull();
    });

    it('resolves framework alias to built-in shim when shims enabled', async () => {
      const context = {
        baseDir: '/workspace/docs',
        workspaceRoot: '/workspace',
        framework: 'docusaurus' as const,
        shimsEnabled: true,
      };

      const result = await resolver.resolveAsync('@theme/Tabs', context);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.isBuiltInShim).toBe(true);
        expect(result.fsPath).toContain('@mdx-preview/shims');
      }
    });

    it('uses TypeScript strategy for non-relative imports with tsconfig', async () => {
      const context = {
        baseDir: '/workspace/src',
        workspaceRoot: '/workspace',
        tsConfig: {
          configPath: '/workspace/tsconfig.json',
          baseUrl: '.',
          paths: { '@utils/*': ['./src/utils/*'] },
        },
      };

      mockTypeScriptStrategy.resolveAsync.mockResolvedValue({
        fsPath: '/workspace/src/utils/helpers.ts',
        specifier: '@utils/helpers',
        strategy: ResolutionStrategy.TypeScript,
        isBuiltInShim: false,
      });

      const result = await resolver.resolveAsync('@utils/helpers', context);

      expect(result).not.toBeNull();
      expect(result?.fsPath).toBe('/workspace/src/utils/helpers.ts');
      expect(result?.strategy).toBe(ResolutionStrategy.TypeScript);
      expect(mockTypeScriptStrategy.resolveAsync).toHaveBeenCalled();
    });

    it('falls back to enhanced-resolve for bare imports when TypeScript returns null', async () => {
      const context = {
        baseDir: '/workspace/src',
        workspaceRoot: '/workspace',
        tsConfig: {
          configPath: '/workspace/tsconfig.json',
          baseUrl: '.',
          paths: {},
        },
      };

      mockTypeScriptStrategy.resolveAsync.mockResolvedValue(null);
      mockEnhancedResolveStrategy.resolve.mockReturnValue({
        fsPath: '/workspace/node_modules/react/index.js',
        specifier: 'react',
        strategy: ResolutionStrategy.EnhancedResolve,
        isBuiltInShim: false,
      });

      const result = await resolver.resolveAsync('react', context);

      expect(result).not.toBeNull();
      expect(result?.fsPath).toBe('/workspace/node_modules/react/index.js');
      expect(result?.strategy).toBe(ResolutionStrategy.EnhancedResolve);
    });

    it('uses file probe strategy for relative imports', async () => {
      const context = {
        baseDir: '/workspace/src',
        workspaceRoot: '/workspace',
      };

      mockFileProbeStrategy.resolveAsync.mockResolvedValue({
        fsPath: '/workspace/src/components/Button.tsx',
        specifier: './components/Button',
        strategy: ResolutionStrategy.FileProbe,
        isBuiltInShim: false,
      });

      const result = await resolver.resolveAsync(
        './components/Button',
        context
      );

      expect(result).not.toBeNull();
      expect(result?.fsPath).toBe('/workspace/src/components/Button.tsx');
      expect(result?.strategy).toBe(ResolutionStrategy.FileProbe);
      expect(mockFileProbeStrategy.resolveAsync).toHaveBeenCalled();
    });

    it('returns null when no strategy can resolve', async () => {
      const context = {
        baseDir: '/workspace/src',
        workspaceRoot: '/workspace',
      };

      mockTypeScriptStrategy.resolveAsync.mockResolvedValue(null);
      mockEnhancedResolveStrategy.resolve.mockReturnValue(null);

      const result = await resolver.resolveAsync(
        'nonexistent-package',
        context
      );

      expect(result).toBeNull();
    });

    it('short-circuits on first successful resolution', async () => {
      const context = {
        baseDir: '/workspace/docs',
        workspaceRoot: '/workspace',
        framework: 'docusaurus' as const,
        shimsEnabled: true,
      };

      // Framework shim should be resolved first, without calling other strategies
      const result = await resolver.resolveAsync('@theme/Tabs', context);

      expect(result).not.toBeNull();
      expect(result?.isBuiltInShim).toBe(true);
      // Other strategies should not have been called
      expect(mockEnhancedResolveStrategy.resolve).not.toHaveBeenCalled();
      expect(mockFileProbeStrategy.resolveAsync).not.toHaveBeenCalled();
    });
  });

  // strategy priority order
  describe('strategy priority order', () => {
    it('resolveSync: framework alias > TypeScript > enhanced-resolve > file-probe', () => {
      // Test that strategies are called in the correct order
      const context = {
        baseDir: '/workspace/src',
        workspaceRoot: '/workspace',
        framework: 'generic' as const,
        // Disable shims to test other strategies
        shimsEnabled: false,
        tsConfig: {
          configPath: '/workspace/tsconfig.json',
          baseUrl: '.',
          paths: { '@test/*': ['./test/*'] },
        },
      };

      // All strategies return null to test full chain
      mockTypeScriptStrategy.resolve.mockReturnValue(null);
      mockEnhancedResolveStrategy.resolve.mockReturnValue(null);

      resolver.resolveSync('some-bare-import', context);

      // For bare imports (non-relative), should try TypeScript then enhanced-resolve
      expect(mockTypeScriptStrategy.resolve).toHaveBeenCalled();
      expect(mockEnhancedResolveStrategy.resolve).toHaveBeenCalled();
      // FileProbe is only for relative imports
      expect(mockFileProbeStrategy.resolve).not.toHaveBeenCalled();
    });

    it('resolveSync: only uses file-probe for relative imports', () => {
      const context = {
        baseDir: '/workspace/src',
        workspaceRoot: '/workspace',
      };

      mockFileProbeStrategy.resolve.mockReturnValue(null);

      resolver.resolveSync('./relative/path', context);

      expect(mockFileProbeStrategy.resolve).toHaveBeenCalled();
      // TypeScript & enhanced-resolve are not used for relative imports
      expect(mockTypeScriptStrategy.resolve).not.toHaveBeenCalled();
      expect(mockEnhancedResolveStrategy.resolve).not.toHaveBeenCalled();
    });

    it('resolveAsync: uses async methods when available', async () => {
      const context = {
        baseDir: '/workspace/src',
        workspaceRoot: '/workspace',
        tsConfig: {
          configPath: '/workspace/tsconfig.json',
          baseUrl: '.',
          paths: { '@test/*': ['./test/*'] },
        },
      };

      mockTypeScriptStrategy.resolveAsync.mockResolvedValue(null);
      mockEnhancedResolveStrategy.resolve.mockReturnValue(null);

      await resolver.resolveAsync('some-import', context);

      // Should use async method for TypeScript strategy
      expect(mockTypeScriptStrategy.resolveAsync).toHaveBeenCalled();
      // Enhanced-resolve doesn't have async, uses sync
      expect(mockEnhancedResolveStrategy.resolve).toHaveBeenCalled();
    });
  });

  // edge cases
  describe('edge cases', () => {
    it('handles empty specifier', () => {
      const context = { baseDir: '/workspace' };

      const syncResult = resolver.resolveSync('', context);
      expect(syncResult).toBeNull();
    });

    it('handles empty specifier async', async () => {
      const context = { baseDir: '/workspace' };

      const asyncResult = await resolver.resolveAsync('', context);
      expect(asyncResult).toBeNull();
    });

    it('handles data: URLs', () => {
      const context = { baseDir: '/workspace' };

      // data: URLs should be passed through shouldResolve
      // Currently they would be resolved (not filtered)
      const result = resolver.shouldResolve(
        'data:text/javascript,export default 1'
      );
      expect(result).toBe(true);
    });

    it('handles file: URLs', () => {
      const context = { baseDir: '/workspace' };

      const result = resolver.shouldResolve('file:///absolute/path.js');
      expect(result).toBe(true);
    });

    it('uses default mode when not specified', async () => {
      const context = {
        baseDir: '/workspace/src',
        workspaceRoot: '/workspace',
      };

      mockFileProbeStrategy.resolveAsync.mockResolvedValue({
        fsPath: '/workspace/src/file.ts',
        specifier: './file',
        strategy: ResolutionStrategy.FileProbe,
        isBuiltInShim: false,
      });

      await resolver.resolveAsync('./file', context);

      // Mode defaults to 'dependency'
      expect(mockFileProbeStrategy.resolveAsync).toHaveBeenCalledWith(
        './file',
        context,
        'dependency'
      );
    });

    it('passes mode to strategies', async () => {
      const context = {
        baseDir: '/workspace/src',
        workspaceRoot: '/workspace',
      };

      mockFileProbeStrategy.resolveAsync.mockResolvedValue({
        fsPath: '/workspace/src/file.ts',
        specifier: './file',
        strategy: ResolutionStrategy.FileProbe,
        isBuiltInShim: false,
      });

      await resolver.resolveAsync('./file', context, 'node');

      expect(mockFileProbeStrategy.resolveAsync).toHaveBeenCalledWith(
        './file',
        context,
        'node'
      );
    });
  });

  // framework alias behavior
  describe('framework alias behavior', () => {
    it('rewrites specifier when alias resolves to non-shim path', () => {
      const context = {
        baseDir: '/workspace/docs',
        workspaceRoot: '/workspace',
        framework: 'docusaurus' as const,
        shimsEnabled: true,
      };

      // @site/src/Button resolves to a workspace path, not a shim
      const result = resolver.resolveSync(
        '@site/src/components/Button',
        context
      );

      // The specifier gets rewritten to the aliased path
      // Since it's not a shim & there's no file, result will be null
      // but the important thing is that it tried to resolve the aliased path
      expect(result).toBeNull();
    });

    it('does not resolve framework alias when framework is generic', () => {
      const context = {
        baseDir: '/workspace/src',
        workspaceRoot: '/workspace',
        framework: 'generic' as const,
        shimsEnabled: true,
      };

      mockEnhancedResolveStrategy.resolve.mockReturnValue(null);

      const result = resolver.resolveSync('@theme/Tabs', context);

      // generic framework has no aliases, so @theme/Tabs goes to other strategies
      expect(result).toBeNull();
      expect(mockEnhancedResolveStrategy.resolve).toHaveBeenCalled();
    });
  });

  // resolveFrameworkAliasStep() helper
  describe('resolveFrameworkAliasStep()', () => {
    it('returns unchanged specifier when no framework', () => {
      const context = {
        baseDir: '/workspace/src',
        workspaceRoot: '/workspace',
        shimsEnabled: true,
      };

      const result = resolveFrameworkAliasStep('@theme/Tabs', context);

      expect(result.specifier).toBe('@theme/Tabs');
      expect(result.earlyResult).toBeUndefined();
    });

    it('returns unchanged specifier when shims disabled', () => {
      const context = {
        baseDir: '/workspace/src',
        workspaceRoot: '/workspace',
        framework: 'docusaurus' as const,
        shimsEnabled: false,
      };

      const result = resolveFrameworkAliasStep('@theme/Tabs', context);

      expect(result.specifier).toBe('@theme/Tabs');
      expect(result.earlyResult).toBeUndefined();
    });

    it('returns unchanged specifier for relative imports', () => {
      const context = {
        baseDir: '/workspace/src',
        workspaceRoot: '/workspace',
        framework: 'docusaurus' as const,
        shimsEnabled: true,
      };

      const result = resolveFrameworkAliasStep('./Button', context);

      expect(result.specifier).toBe('./Button');
      expect(result.earlyResult).toBeUndefined();
    });

    it('returns unchanged specifier for ../ relative imports', () => {
      const context = {
        baseDir: '/workspace/src',
        workspaceRoot: '/workspace',
        framework: 'docusaurus' as const,
        shimsEnabled: true,
      };

      const result = resolveFrameworkAliasStep('../utils/helpers', context);

      expect(result.specifier).toBe('../utils/helpers');
      expect(result.earlyResult).toBeUndefined();
    });

    it('returns earlyResult for built-in shim', () => {
      const context = {
        baseDir: '/workspace/docs',
        workspaceRoot: '/workspace',
        framework: 'docusaurus' as const,
        shimsEnabled: true,
      };

      const result = resolveFrameworkAliasStep('@theme/Tabs', context);

      expect(result.earlyResult).not.toBeUndefined();
      expect(result.earlyResult?.isBuiltInShim).toBe(true);
      expect(result.earlyResult?.fsPath).toContain('@mdx-preview/shims');
    });

    it('rewrites specifier for non-shim alias', () => {
      const context = {
        baseDir: '/workspace/docs',
        workspaceRoot: '/workspace',
        framework: 'docusaurus' as const,
        shimsEnabled: true,
      };

      // @site resolves to workspace path, not a shim
      const result = resolveFrameworkAliasStep(
        '@site/src/components/Button',
        context
      );

      // specifier gets rewritten, no early result
      expect(result.earlyResult).toBeUndefined();
      expect(result.specifier).not.toBe('@site/src/components/Button');
    });

    it('returns unchanged specifier when alias does not match', () => {
      const context = {
        baseDir: '/workspace/src',
        workspaceRoot: '/workspace',
        framework: 'docusaurus' as const,
        shimsEnabled: true,
      };

      const result = resolveFrameworkAliasStep('react', context);

      // react is not a docusaurus alias
      expect(result.specifier).toBe('react');
      expect(result.earlyResult).toBeUndefined();
    });
  });
});
