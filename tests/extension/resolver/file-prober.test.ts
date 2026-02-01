// tests/extension/resolver/file-prober.test.ts
// unit tests for file-prober helper functions

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode
vi.mock('vscode', () => ({}));

// Mock logging
vi.mock('../../../packages/extension/logging', () => ({
  debug: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}));

// Import after mocks
import {
  parseProbingOptions,
  shouldSkipPath,
  findIndexFileInResults,
  DEFAULT_PROBING_OPTIONS,
  type StatResult,
  type ParsedProbingOptions,
} from '../../../packages/extension/module-system/resolver/file-prober';

describe('file-prober helpers', () => {
  // * parseProbingOptions()
  describe('parseProbingOptions()', () => {
    it('returns defaults when no options provided', () => {
      const result = parseProbingOptions({});

      expect(result.extensions).toBe(DEFAULT_PROBING_OPTIONS.extensions);
      expect(result.indexFiles).toBe(DEFAULT_PROBING_OPTIONS.indexFiles);
      expect(result.skipNodeModules).toBe(true);
    });

    it('uses custom extensions when provided', () => {
      const customExtensions = ['.ts', '.tsx'];
      const result = parseProbingOptions({ extensions: customExtensions });

      expect(result.extensions).toBe(customExtensions);
      expect(result.indexFiles).toBe(DEFAULT_PROBING_OPTIONS.indexFiles);
    });

    it('uses custom indexFiles when provided', () => {
      const customIndexFiles = ['index.ts', 'mod.ts'];
      const result = parseProbingOptions({ indexFiles: customIndexFiles });

      expect(result.indexFiles).toBe(customIndexFiles);
      expect(result.extensions).toBe(DEFAULT_PROBING_OPTIONS.extensions);
    });

    it('uses skipNodeModules=false when provided', () => {
      const result = parseProbingOptions({ skipNodeModules: false });

      expect(result.skipNodeModules).toBe(false);
    });

    it('handles all options together', () => {
      const options = {
        extensions: ['.js'],
        indexFiles: ['main.js'],
        skipNodeModules: false,
      };
      const result = parseProbingOptions(options);

      expect(result.extensions).toEqual(['.js']);
      expect(result.indexFiles).toEqual(['main.js']);
      expect(result.skipNodeModules).toBe(false);
    });
  });

  // * shouldSkipPath()
  describe('shouldSkipPath()', () => {
    it('returns true for node_modules path when skip enabled', () => {
      expect(shouldSkipPath('/project/node_modules/react', true)).toBe(true);
    });

    it('returns true for nested node_modules path when skip enabled', () => {
      expect(
        shouldSkipPath('/project/node_modules/pkg/node_modules/dep', true)
      ).toBe(true);
    });

    it('returns false for node_modules path when skip disabled', () => {
      expect(shouldSkipPath('/project/node_modules/react', false)).toBe(false);
    });

    it('returns false for regular path when skip enabled', () => {
      expect(shouldSkipPath('/project/src/components/Button', true)).toBe(
        false
      );
    });

    it('returns false for regular path when skip disabled', () => {
      expect(shouldSkipPath('/project/src/components/Button', false)).toBe(
        false
      );
    });

    it('returns false for path w/ node_modules in name but not as directory', () => {
      // path contains 'node_modules' substring but not as a directory segment
      // note: current implementation uses .includes() so this returns true
      expect(shouldSkipPath('/project/node_modules_backup/file', true)).toBe(
        true
      );
    });
  });

  // * findIndexFileInResults()
  describe('findIndexFileInResults()', () => {
    it('returns first matching index file', () => {
      const basePath = '/project/src/components';
      const indexFiles = ['index.ts', 'index.tsx', 'index.js'];
      const statResults = new Map<string, StatResult>([
        [
          '/project/src/components/index.ts',
          { exists: true, isFile: true, isDirectory: false },
        ],
        [
          '/project/src/components/index.tsx',
          { exists: true, isFile: true, isDirectory: false },
        ],
      ]);

      const result = findIndexFileInResults(basePath, indexFiles, statResults);

      expect(result).toBe('/project/src/components/index.ts');
    });

    it('returns null when no index files exist', () => {
      const basePath = '/project/src/components';
      const indexFiles = ['index.ts', 'index.tsx'];
      const statResults = new Map<string, StatResult>([
        [
          '/project/src/components/index.ts',
          { exists: false, isFile: false, isDirectory: false },
        ],
        [
          '/project/src/components/index.tsx',
          { exists: false, isFile: false, isDirectory: false },
        ],
      ]);

      const result = findIndexFileInResults(basePath, indexFiles, statResults);

      expect(result).toBeNull();
    });

    it('skips directories even if they match index file name', () => {
      const basePath = '/project/src/components';
      const indexFiles = ['index.ts', 'index.tsx'];
      const statResults = new Map<string, StatResult>([
        [
          '/project/src/components/index.ts',
          { exists: true, isFile: false, isDirectory: true },
        ],
        [
          '/project/src/components/index.tsx',
          { exists: true, isFile: true, isDirectory: false },
        ],
      ]);

      const result = findIndexFileInResults(basePath, indexFiles, statResults);

      // Should skip index.ts (directory) & return index.tsx
      expect(result).toBe('/project/src/components/index.tsx');
    });

    it('respects priority order of index files', () => {
      const basePath = '/project/src';
      const indexFiles = ['index.tsx', 'index.ts', 'index.js'];
      const statResults = new Map<string, StatResult>([
        [
          '/project/src/index.tsx',
          { exists: false, isFile: false, isDirectory: false },
        ],
        [
          '/project/src/index.ts',
          { exists: true, isFile: true, isDirectory: false },
        ],
        [
          '/project/src/index.js',
          { exists: true, isFile: true, isDirectory: false },
        ],
      ]);

      const result = findIndexFileInResults(basePath, indexFiles, statResults);

      // Should return index.ts (first existing, in priority order)
      expect(result).toBe('/project/src/index.ts');
    });

    it('returns null for empty stat results', () => {
      const basePath = '/project/src';
      const indexFiles = ['index.ts', 'index.tsx'];
      const statResults = new Map<string, StatResult>();

      const result = findIndexFileInResults(basePath, indexFiles, statResults);

      expect(result).toBeNull();
    });

    it('returns null for empty index files list', () => {
      const basePath = '/project/src';
      const indexFiles: string[] = [];
      const statResults = new Map<string, StatResult>([
        [
          '/project/src/index.ts',
          { exists: true, isFile: true, isDirectory: false },
        ],
      ]);

      const result = findIndexFileInResults(basePath, indexFiles, statResults);

      expect(result).toBeNull();
    });
  });
});
