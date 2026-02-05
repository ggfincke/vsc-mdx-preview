// tests/resolution/EnhancedResolveStrategy.test.ts
// Regression tests for EnhancedResolveStrategy - node_modules resolution

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock vscode
vi.mock('vscode', () => ({}));

// Mock logging
vi.mock('../../packages/extension/logging', () => ({
  debug: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  createTaggedLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

// Mock resolver factory
const mockBrowserResolver = {
  resolveSync: vi.fn(),
};
const mockNodeResolver = {
  resolveSync: vi.fn(),
};
vi.mock(
  '../../packages/extension/module-system/resolver/resolver-factory',
  () => ({
    getBrowserResolver: () => mockBrowserResolver,
    getNodeResolver: () => mockNodeResolver,
  })
);

// Import after mocks
import {
  EnhancedResolveStrategy,
  getEnhancedResolveStrategy,
} from '../../packages/extension/module-system/resolver/strategies/EnhancedResolveStrategy';
import { ResolutionStrategy } from '../../packages/extension/types';

describe('EnhancedResolveStrategy', () => {
  let strategy: EnhancedResolveStrategy;

  beforeEach(() => {
    vi.clearAllMocks();
    strategy = new EnhancedResolveStrategy();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to create resolution context
  const createContext = (baseDir: string) => ({
    baseDir,
    workspaceRoot: '/workspace',
  });

  // basic strategy behavior
  describe('basic strategy behavior', () => {
    it('should have correct name', () => {
      expect(strategy.name).toBe('EnhancedResolve');
    });
  });

  // synchronous resolution
  describe('resolve()', () => {
    it('should resolve node_modules package', () => {
      const context = createContext('/workspace/src');
      mockBrowserResolver.resolveSync.mockReturnValue(
        '/workspace/node_modules/lodash/lodash.js'
      );

      const result = strategy.resolve('lodash', context, 'dependency');

      expect(result).not.toBeNull();
      expect(result?.fsPath).toBe('/workspace/node_modules/lodash/lodash.js');
      expect(result?.specifier).toBe('lodash');
      expect(result?.strategy).toBe(ResolutionStrategy.EnhancedResolve);
    });

    it('should resolve scoped package', () => {
      const context = createContext('/workspace/src');
      mockBrowserResolver.resolveSync.mockReturnValue(
        '/workspace/node_modules/@emotion/react/dist/emotion-react.esm.js'
      );

      const result = strategy.resolve('@emotion/react', context, 'dependency');

      expect(result?.fsPath).toBe(
        '/workspace/node_modules/@emotion/react/dist/emotion-react.esm.js'
      );
    });

    it('should resolve package subpath', () => {
      const context = createContext('/workspace/src');
      mockBrowserResolver.resolveSync.mockReturnValue(
        '/workspace/node_modules/lodash/debounce.js'
      );

      const result = strategy.resolve('lodash/debounce', context, 'dependency');

      expect(result?.fsPath).toBe('/workspace/node_modules/lodash/debounce.js');
      expect(result?.specifier).toBe('lodash/debounce');
    });

    it('should return null when module not found', () => {
      const context = createContext('/workspace/src');
      mockBrowserResolver.resolveSync.mockImplementation(() => {
        throw new Error('Module not found');
      });

      const result = strategy.resolve(
        'nonexistent-package',
        context,
        'dependency'
      );

      expect(result).toBeNull();
    });

    it('should return null when resolver returns falsy value', () => {
      const context = createContext('/workspace/src');
      mockBrowserResolver.resolveSync.mockReturnValue(null);

      const result = strategy.resolve('some-package', context, 'dependency');

      expect(result).toBeNull();
    });
  });

  // resolution mode handling
  describe('resolution mode handling', () => {
    it('should use browser resolver for dependency mode', () => {
      const context = createContext('/workspace/src');
      mockBrowserResolver.resolveSync.mockReturnValue(
        '/workspace/node_modules/react/index.js'
      );

      strategy.resolve('react', context, 'dependency');

      expect(mockBrowserResolver.resolveSync).toHaveBeenCalled();
      expect(mockNodeResolver.resolveSync).not.toHaveBeenCalled();
    });

    it('should use browser resolver for browser mode', () => {
      const context = createContext('/workspace/src');
      mockBrowserResolver.resolveSync.mockReturnValue(
        '/workspace/node_modules/react/index.js'
      );

      strategy.resolve('react', context, 'browser');

      expect(mockBrowserResolver.resolveSync).toHaveBeenCalled();
      expect(mockNodeResolver.resolveSync).not.toHaveBeenCalled();
    });

    it('should use node resolver for node mode', () => {
      const context = createContext('/workspace/src');
      mockNodeResolver.resolveSync.mockReturnValue(
        '/workspace/node_modules/fs-extra/lib/index.js'
      );

      strategy.resolve('fs-extra', context, 'node');

      expect(mockNodeResolver.resolveSync).toHaveBeenCalled();
      expect(mockBrowserResolver.resolveSync).not.toHaveBeenCalled();
    });
  });

  // error handling
  describe('error handling', () => {
    it('should catch resolver exceptions and return null', () => {
      const context = createContext('/workspace/src');
      mockBrowserResolver.resolveSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });

      const result = strategy.resolve('missing', context, 'dependency');

      expect(result).toBeNull();
    });

    it('should handle resolver throwing non-Error objects', () => {
      const context = createContext('/workspace/src');
      mockBrowserResolver.resolveSync.mockImplementation(() => {
        throw 'string error';
      });

      const result = strategy.resolve('package', context, 'dependency');

      expect(result).toBeNull();
    });
  });

  // resolver call arguments
  describe('resolver call arguments', () => {
    it('should pass correct arguments to resolver', () => {
      const context = createContext('/workspace/src');
      mockBrowserResolver.resolveSync.mockReturnValue(
        '/workspace/node_modules/react/index.js'
      );

      strategy.resolve('react', context, 'dependency');

      expect(mockBrowserResolver.resolveSync).toHaveBeenCalledWith(
        {},
        '/workspace/src',
        'react'
      );
    });

    it('should use baseDir from context', () => {
      const context = createContext('/different/base/dir');
      mockBrowserResolver.resolveSync.mockReturnValue('/some/path');

      strategy.resolve('package', context, 'dependency');

      expect(mockBrowserResolver.resolveSync).toHaveBeenCalledWith(
        {},
        '/different/base/dir',
        'package'
      );
    });
  });

  // result structure
  describe('result structure', () => {
    it('should return correct ResolutionResult structure', () => {
      const context = createContext('/workspace/src');
      mockBrowserResolver.resolveSync.mockReturnValue(
        '/workspace/node_modules/react/index.js'
      );

      const result = strategy.resolve('react', context, 'dependency');

      expect(result).toEqual({
        fsPath: '/workspace/node_modules/react/index.js',
        specifier: 'react',
        strategy: ResolutionStrategy.EnhancedResolve,
        isBuiltInShim: false,
      });
    });

    it('should preserve original specifier in result', () => {
      const context = createContext('/workspace/src');
      mockBrowserResolver.resolveSync.mockReturnValue(
        '/workspace/node_modules/lodash/fp/debounce.js'
      );

      const result = strategy.resolve(
        'lodash/fp/debounce',
        context,
        'dependency'
      );

      expect(result?.specifier).toBe('lodash/fp/debounce');
    });
  });

  // singleton behavior
  describe('singleton behavior', () => {
    it('getEnhancedResolveStrategy should return same instance', () => {
      const instance1 = getEnhancedResolveStrategy();
      const instance2 = getEnhancedResolveStrategy();

      expect(instance1).toBe(instance2);
    });

    it('singleton should have correct name', () => {
      const instance = getEnhancedResolveStrategy();
      expect(instance.name).toBe('EnhancedResolve');
    });
  });

  // edge cases
  describe('edge cases', () => {
    it('should handle deeply nested package paths', () => {
      const context = createContext('/workspace/src');
      mockBrowserResolver.resolveSync.mockReturnValue(
        '/workspace/node_modules/@org/package/dist/sub/module.js'
      );

      const result = strategy.resolve(
        '@org/package/dist/sub/module',
        context,
        'dependency'
      );

      expect(result?.fsPath).toBe(
        '/workspace/node_modules/@org/package/dist/sub/module.js'
      );
    });

    it('should handle empty specifier', () => {
      const context = createContext('/workspace/src');
      mockBrowserResolver.resolveSync.mockImplementation(() => {
        throw new Error('Invalid specifier');
      });

      const result = strategy.resolve('', context, 'dependency');

      expect(result).toBeNull();
    });

    it('should handle JSON modules', () => {
      const context = createContext('/workspace/src');
      mockBrowserResolver.resolveSync.mockReturnValue(
        '/workspace/node_modules/package/package.json'
      );

      const result = strategy.resolve(
        'package/package.json',
        context,
        'dependency'
      );

      expect(result?.fsPath).toBe(
        '/workspace/node_modules/package/package.json'
      );
    });
  });
});
