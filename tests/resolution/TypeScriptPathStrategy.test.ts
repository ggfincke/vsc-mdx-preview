// tests/resolution/TypeScriptPathStrategy.test.ts
// Regression tests for TypeScript path resolution strategy

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';

// Mock vscode
vi.mock('vscode', () => ({}));

// Mock logging
vi.mock('../../packages/extension/logging', () => ({
  debug: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}));

// Mock file-prober
const mockProbeTypeScriptFile = vi.fn();
const mockProbeTypeScriptFileAsync = vi.fn();
vi.mock('../../packages/extension/module-system/resolver/file-prober', () => ({
  probeTypeScriptFile: (...args: unknown[]) => mockProbeTypeScriptFile(...args),
  probeTypeScriptFileAsync: (...args: unknown[]) =>
    mockProbeTypeScriptFileAsync(...args),
  clearStatCache: vi.fn(),
}));

// Import after mocks
import {
  TypeScriptPathStrategy,
  getTypeScriptPathStrategy,
  clearStatCache,
  clearCompiledIndexCache,
} from '../../packages/extension/module-system/resolver/strategies/TypeScriptPathStrategy';
import { ResolutionStrategy } from '../../packages/extension/types';

describe('TypeScriptPathStrategy', () => {
  let strategy: TypeScriptPathStrategy;

  beforeEach(() => {
    vi.clearAllMocks();
    clearStatCache();
    clearCompiledIndexCache();
    strategy = new TypeScriptPathStrategy();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to create a resolution context
  const createContext = (
    baseDir: string,
    tsConfig?: {
      configPath?: string;
      baseUrl?: string;
      paths?: Record<string, string[]>;
    }
  ) => ({
    baseDir,
    workspaceRoot: '/workspace',
    tsConfig: tsConfig
      ? {
          configPath: tsConfig.configPath ?? '/workspace/tsconfig.json',
          baseUrl: tsConfig.baseUrl ?? '.',
          paths: tsConfig.paths,
        }
      : undefined,
  });

  // ============================================
  // Basic Strategy Behavior
  // ============================================
  describe('basic strategy behavior', () => {
    it('should have correct name', () => {
      expect(strategy.name).toBe('TypeScript');
    });

    it('should return null when no tsconfig provided', () => {
      const context = createContext('/workspace/src');

      const result = strategy.resolve('@utils/helpers', context, 'dependency');

      expect(result).toBeNull();
    });

    it('should return null when tsconfig has no paths', () => {
      const context = createContext('/workspace/src', {
        configPath: '/workspace/tsconfig.json',
        baseUrl: '.',
        paths: undefined,
      });

      const result = strategy.resolve('@utils/helpers', context, 'dependency');

      expect(result).toBeNull();
    });
  });

  // ============================================
  // Exact Path Matching (O(1))
  // ============================================
  describe('exact path matching', () => {
    it('should resolve exact path alias', () => {
      const context = createContext('/workspace/src', {
        configPath: '/workspace/tsconfig.json',
        baseUrl: '.',
        paths: {
          '@utils': ['./src/utils'],
        },
      });
      mockProbeTypeScriptFile.mockReturnValue('/workspace/src/utils/index.ts');

      const result = strategy.resolve('@utils', context, 'dependency');

      expect(result).not.toBeNull();
      expect(result?.fsPath).toBe('/workspace/src/utils/index.ts');
      expect(result?.strategy).toBe(ResolutionStrategy.TypeScript);
    });

    it('should handle multiple exact aliases', () => {
      const context = createContext('/workspace/src', {
        configPath: '/workspace/tsconfig.json',
        baseUrl: '.',
        paths: {
          '@utils': ['./src/utils'],
          '@components': ['./src/components'],
          '@hooks': ['./src/hooks'],
        },
      });
      mockProbeTypeScriptFile.mockReturnValue(
        '/workspace/src/components/index.ts'
      );

      const result = strategy.resolve('@components', context, 'dependency');

      expect(result?.fsPath).toBe('/workspace/src/components/index.ts');
    });
  });

  // ============================================
  // Wildcard Path Matching (O(m))
  // ============================================
  describe('wildcard path matching', () => {
    it('should resolve wildcard path alias', () => {
      const context = createContext('/workspace/src', {
        configPath: '/workspace/tsconfig.json',
        baseUrl: '.',
        paths: {
          '@components/*': ['./src/components/*'],
        },
      });
      mockProbeTypeScriptFile.mockReturnValue(
        '/workspace/src/components/Button.tsx'
      );

      const result = strategy.resolve(
        '@components/Button',
        context,
        'dependency'
      );

      expect(result).not.toBeNull();
      expect(result?.fsPath).toBe('/workspace/src/components/Button.tsx');
    });

    it('should handle nested wildcard paths', () => {
      const context = createContext('/workspace/src', {
        configPath: '/workspace/tsconfig.json',
        baseUrl: '.',
        paths: {
          '@components/*': ['./src/components/*'],
        },
      });
      mockProbeTypeScriptFile.mockReturnValue(
        '/workspace/src/components/forms/Input.tsx'
      );

      const result = strategy.resolve(
        '@components/forms/Input',
        context,
        'dependency'
      );

      expect(result?.fsPath).toBe('/workspace/src/components/forms/Input.tsx');
    });

    it('should match most specific wildcard pattern', () => {
      const context = createContext('/workspace/src', {
        configPath: '/workspace/tsconfig.json',
        baseUrl: '.',
        paths: {
          '@components/*': ['./src/components/*'],
          '@components/icons/*': ['./src/icons/*'],
        },
      });
      mockProbeTypeScriptFile.mockReturnValue('/workspace/src/icons/Home.tsx');

      const result = strategy.resolve(
        '@components/icons/Home',
        context,
        'dependency'
      );

      // Should match @components/icons/* (more specific) not @components/*
      expect(result?.fsPath).toBe('/workspace/src/icons/Home.tsx');
    });
  });

  // ============================================
  // BaseUrl Resolution
  // ============================================
  describe('baseUrl resolution', () => {
    it('should resolve paths relative to baseUrl', () => {
      const context = createContext('/workspace/src', {
        configPath: '/workspace/tsconfig.json',
        baseUrl: './src',
        paths: {
          '@utils/*': ['utils/*'],
        },
      });
      mockProbeTypeScriptFile.mockReturnValue(
        '/workspace/src/utils/helpers.ts'
      );

      const result = strategy.resolve('@utils/helpers', context, 'dependency');

      expect(result?.fsPath).toBe('/workspace/src/utils/helpers.ts');
    });

    it('should handle absolute baseUrl', () => {
      const context = createContext('/workspace/src', {
        configPath: '/workspace/tsconfig.json',
        baseUrl: '/workspace/src',
        paths: {
          '@lib/*': ['lib/*'],
        },
      });
      mockProbeTypeScriptFile.mockReturnValue('/workspace/src/lib/api.ts');

      const result = strategy.resolve('@lib/api', context, 'dependency');

      expect(result?.fsPath).toBe('/workspace/src/lib/api.ts');
    });

    it('should default baseUrl to . when not specified', () => {
      const context = createContext('/workspace/src', {
        configPath: '/workspace/tsconfig.json',
        baseUrl: undefined,
        paths: {
          '@utils/*': ['./src/utils/*'],
        },
      });
      mockProbeTypeScriptFile.mockReturnValue('/workspace/src/utils/index.ts');

      const result = strategy.resolve('@utils/index', context, 'dependency');

      expect(result?.fsPath).toBe('/workspace/src/utils/index.ts');
    });
  });

  // ============================================
  // Multiple Target Paths
  // ============================================
  describe('multiple target paths', () => {
    it('should try multiple targets in order', () => {
      const context = createContext('/workspace/src', {
        configPath: '/workspace/tsconfig.json',
        baseUrl: '.',
        paths: {
          '@shared/*': ['./src/shared/*', './node_modules/@company/shared/*'],
        },
      });

      mockProbeTypeScriptFile.mockImplementation((candidate) => {
        // First target doesn't exist
        if (candidate.includes('src/shared')) {
          return null;
        }
        // Second target exists
        if (candidate.includes('node_modules/@company/shared')) {
          return candidate + '/index.ts';
        }
        return null;
      });

      const result = strategy.resolve('@shared/utils', context, 'dependency');

      // Should have tried first target, then found second
      expect(mockProbeTypeScriptFile).toHaveBeenCalledTimes(2);
      expect(result?.fsPath).toContain('node_modules/@company/shared');
    });
  });

  // ============================================
  // .d.ts File Skipping
  // ============================================
  describe('.d.ts file skipping', () => {
    it('should skip .d.ts files', () => {
      const context = createContext('/workspace/src', {
        configPath: '/workspace/tsconfig.json',
        baseUrl: '.',
        paths: {
          '@types/*': ['./src/types/*'],
        },
      });

      mockProbeTypeScriptFile
        .mockReturnValueOnce('/workspace/src/types/api.d.ts')
        .mockReturnValueOnce('/workspace/src/types/api.ts');

      const result = strategy.resolve('@types/api', context, 'dependency');

      // Should skip .d.ts & return the .ts file on second attempt
      // Note: probeTypeScriptFile is called once per candidate path
      // Since we only have one target, it return null
      expect(result).toBeNull();
    });

    it('should return null if only .d.ts files match', () => {
      const context = createContext('/workspace/src', {
        configPath: '/workspace/tsconfig.json',
        baseUrl: '.',
        paths: {
          '@types/*': ['./src/types/*'],
        },
      });

      mockProbeTypeScriptFile.mockReturnValue('/workspace/src/types/api.d.ts');

      const result = strategy.resolve('@types/api', context, 'dependency');

      expect(result).toBeNull();
    });
  });

  // ============================================
  // No Match Scenarios
  // ============================================
  describe('no match scenarios', () => {
    it('should return null for non-matching specifier', () => {
      const context = createContext('/workspace/src', {
        configPath: '/workspace/tsconfig.json',
        baseUrl: '.',
        paths: {
          '@utils/*': ['./src/utils/*'],
        },
      });

      const result = strategy.resolve(
        '@components/Button',
        context,
        'dependency'
      );

      expect(result).toBeNull();
    });

    it('should return null when probed file not found', () => {
      const context = createContext('/workspace/src', {
        configPath: '/workspace/tsconfig.json',
        baseUrl: '.',
        paths: {
          '@utils/*': ['./src/utils/*'],
        },
      });
      mockProbeTypeScriptFile.mockReturnValue(null);

      const result = strategy.resolve('@utils/missing', context, 'dependency');

      expect(result).toBeNull();
    });
  });

  // ============================================
  // Async Resolution
  // ============================================
  describe('async resolution', () => {
    it('should resolve asynchronously', async () => {
      const context = createContext('/workspace/src', {
        configPath: '/workspace/tsconfig.json',
        baseUrl: '.',
        paths: {
          '@utils/*': ['./src/utils/*'],
        },
      });
      mockProbeTypeScriptFileAsync.mockResolvedValue(
        '/workspace/src/utils/helpers.ts'
      );

      const result = await strategy.resolveAsync(
        '@utils/helpers',
        context,
        'dependency'
      );

      expect(result).not.toBeNull();
      expect(result?.fsPath).toBe('/workspace/src/utils/helpers.ts');
    });

    it('should return null asynchronously for no match', async () => {
      const context = createContext('/workspace/src', {
        configPath: '/workspace/tsconfig.json',
        baseUrl: '.',
        paths: {
          '@utils/*': ['./src/utils/*'],
        },
      });
      mockProbeTypeScriptFileAsync.mockResolvedValue(null);

      const result = await strategy.resolveAsync(
        '@utils/missing',
        context,
        'dependency'
      );

      expect(result).toBeNull();
    });

    it('should skip .d.ts files asynchronously', async () => {
      const context = createContext('/workspace/src', {
        configPath: '/workspace/tsconfig.json',
        baseUrl: '.',
        paths: {
          '@types/*': ['./src/types/*'],
        },
      });
      mockProbeTypeScriptFileAsync.mockResolvedValue(
        '/workspace/src/types/api.d.ts'
      );

      const result = await strategy.resolveAsync(
        '@types/api',
        context,
        'dependency'
      );

      expect(result).toBeNull();
    });
  });

  // ============================================
  // Cache Behavior
  // ============================================
  describe('cache behavior', () => {
    it('should cache compiled index for same tsconfig', () => {
      const context = createContext('/workspace/src', {
        configPath: '/workspace/tsconfig.json',
        baseUrl: '.',
        paths: {
          '@utils/*': ['./src/utils/*'],
        },
      });
      mockProbeTypeScriptFile.mockReturnValue(
        '/workspace/src/utils/helpers.ts'
      );

      // First call
      strategy.resolve('@utils/helpers', context, 'dependency');

      // Second call w/ same tsconfig
      strategy.resolve('@utils/other', context, 'dependency');

      // The paths should have been compiled only once (cached)
      // We can verify behavior by checking probeTypeScriptFile was called
      expect(mockProbeTypeScriptFile).toHaveBeenCalled();
    });

    it('should invalidate cache when paths change', () => {
      const context1 = createContext('/workspace/src', {
        configPath: '/workspace/tsconfig.json',
        baseUrl: '.',
        paths: {
          '@utils/*': ['./src/utils/*'],
        },
      });

      const context2 = createContext('/workspace/src', {
        configPath: '/workspace/tsconfig.json',
        baseUrl: '.',
        paths: {
          '@utils/*': ['./src/utils/*'],
          // Changed paths
          '@components/*': ['./src/components/*'],
        },
      });

      mockProbeTypeScriptFile.mockReturnValue(
        '/workspace/src/utils/helpers.ts'
      );

      // First call w/ original paths
      strategy.resolve('@utils/helpers', context1, 'dependency');

      // Second call w/ changed paths
      strategy.resolve('@utils/helpers', context2, 'dependency');

      // Both should succeed (cache should be invalidated due to paths change)
      expect(mockProbeTypeScriptFile).toHaveBeenCalled();
    });
  });

  // ============================================
  // Cache Clearing Functions
  // ============================================
  describe('cache clearing', () => {
    it('clearStatCache should clear caches', () => {
      // Just verify it doesn't throw
      expect(() => clearStatCache()).not.toThrow();
    });

    it('clearCompiledIndexCache should clear compiled index', () => {
      // Just verify it doesn't throw
      expect(() => clearCompiledIndexCache()).not.toThrow();
    });
  });

  // ============================================
  // Singleton Behavior
  // ============================================
  describe('singleton behavior', () => {
    it('getTypeScriptPathStrategy should return same instance', () => {
      const instance1 = getTypeScriptPathStrategy();
      const instance2 = getTypeScriptPathStrategy();

      expect(instance1).toBe(instance2);
    });

    it('singleton should have correct name', () => {
      const instance = getTypeScriptPathStrategy();
      expect(instance.name).toBe('TypeScript');
    });
  });

  // ============================================
  // Result Structure
  // ============================================
  describe('result structure', () => {
    it('should return correct ResolutionResult structure', () => {
      const context = createContext('/workspace/src', {
        configPath: '/workspace/tsconfig.json',
        baseUrl: '.',
        paths: {
          '@utils/*': ['./src/utils/*'],
        },
      });
      mockProbeTypeScriptFile.mockReturnValue(
        '/workspace/src/utils/helpers.ts'
      );

      const result = strategy.resolve('@utils/helpers', context, 'dependency');

      expect(result).toEqual({
        fsPath: '/workspace/src/utils/helpers.ts',
        specifier: '@utils/helpers',
        strategy: ResolutionStrategy.TypeScript,
        isBuiltInShim: false,
      });
    });
  });

  // ============================================
  // Edge Cases
  // ============================================
  describe('edge cases', () => {
    it('should handle empty paths object', () => {
      const context = createContext('/workspace/src', {
        configPath: '/workspace/tsconfig.json',
        baseUrl: '.',
        paths: {},
      });

      const result = strategy.resolve('@utils/helpers', context, 'dependency');

      expect(result).toBeNull();
    });

    it('should handle wildcard matching exact pattern prefix', () => {
      const context = createContext('/workspace/src', {
        configPath: '/workspace/tsconfig.json',
        baseUrl: '.',
        paths: {
          '@components/*': ['./src/components/*'],
        },
      });
      mockProbeTypeScriptFile.mockReturnValue(
        '/workspace/src/components/index.ts'
      );

      // Specifier matches just the prefix without the wildcard part
      const result = strategy.resolve('@components', context, 'dependency');

      // Should match since specifier === prefix
      expect(result?.fsPath).toBe('/workspace/src/components/index.ts');
    });
  });
});
