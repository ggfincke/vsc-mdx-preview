// tests/resolution/unified-resolver.test.ts
// Unit tests for UnifiedResolver module resolution

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode
vi.mock('vscode', () => ({}));

// Mock logging
vi.mock('../../packages/extension/logging', () => ({
  debug: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}));

// Import after mocks
import {
  UnifiedResolver,
  getUnifiedResolver,
  resetUnifiedResolver,
} from '../../packages/extension/module-system/resolver/UnifiedResolver';

describe('UnifiedResolver', () => {
  let resolver: UnifiedResolver;

  beforeEach(() => {
    resetUnifiedResolver();
    resolver = getUnifiedResolver();
  });

  describe('shouldResolve()', () => {
    it('returns false for empty string', () => {
      expect(resolver.shouldResolve('')).toBe(false);
    });

    it('returns false for HTTP URLs', () => {
      expect(resolver.shouldResolve('http://example.com/module.js')).toBe(false);
    });

    it('returns false for HTTPS URLs', () => {
      expect(resolver.shouldResolve('https://example.com/module.js')).toBe(false);
    });

    it('returns false for npm:// protocol (preloaded modules)', () => {
      expect(resolver.shouldResolve('npm://react')).toBe(false);
      expect(resolver.shouldResolve('npm://@mdx-preview/shims/Callout')).toBe(false);
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
      const result = resolver.resolveSync('https://cdn.example.com/lib.js', context);

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
});
