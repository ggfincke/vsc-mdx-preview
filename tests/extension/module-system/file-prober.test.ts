// tests/extension/module-system/file-prober.test.ts
// unit tests for file probing utilities

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import {
  TYPESCRIPT_EXTENSIONS,
  TYPESCRIPT_INDEX_FILES,
  FILE_PROBE_EXTENSIONS,
  FILE_PROBE_INDEX_FILES,
  clearStatCache,
  getCachedStat,
  setCachedStat,
  getOrCreateStat,
  batchStatAsync,
  probeFile,
  probeFileAsync,
  probeTypeScriptFile,
  probeTypeScriptFileAsync,
  probeModuleFile,
  probeModuleFileAsync,
} from '../../../packages/extension/module-system/resolver/file-prober';

// Mock fs module
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    statSync: vi.fn(),
    promises: {
      stat: vi.fn(),
    },
  };
});

describe('file-prober', () => {
  beforeEach(() => {
    clearStatCache();
    vi.clearAllMocks();
  });

  describe('extension constants', () => {
    it('should export TYPESCRIPT_EXTENSIONS with correct values', () => {
      expect(TYPESCRIPT_EXTENSIONS).toContain('.ts');
      expect(TYPESCRIPT_EXTENSIONS).toContain('.tsx');
      expect(TYPESCRIPT_EXTENSIONS).toContain('.js');
      expect(TYPESCRIPT_EXTENSIONS).toContain('.jsx');
      expect(TYPESCRIPT_EXTENSIONS).toContain('.mjs');
      expect(TYPESCRIPT_EXTENSIONS).toContain('.json');
      expect(TYPESCRIPT_EXTENSIONS).toContain(''); // empty string for exact match
    });

    it('should export TYPESCRIPT_INDEX_FILES with correct values', () => {
      expect(TYPESCRIPT_INDEX_FILES).toContain('index.ts');
      expect(TYPESCRIPT_INDEX_FILES).toContain('index.tsx');
      expect(TYPESCRIPT_INDEX_FILES).toContain('index.js');
      expect(TYPESCRIPT_INDEX_FILES).toContain('index.jsx');
      expect(TYPESCRIPT_INDEX_FILES).toContain('index.mjs');
    });

    it('should export FILE_PROBE_EXTENSIONS with MDX support', () => {
      expect(FILE_PROBE_EXTENSIONS).toContain('.ts');
      expect(FILE_PROBE_EXTENSIONS).toContain('.tsx');
      expect(FILE_PROBE_EXTENSIONS).toContain('.mdx');
      expect(FILE_PROBE_EXTENSIONS).toContain('.md');
    });

    it('should export FILE_PROBE_INDEX_FILES', () => {
      expect(FILE_PROBE_INDEX_FILES).toContain('index.ts');
      expect(FILE_PROBE_INDEX_FILES).toContain('index.tsx');
      expect(FILE_PROBE_INDEX_FILES).toContain('index.js');
      expect(FILE_PROBE_INDEX_FILES).toContain('index.jsx');
    });
  });

  describe('stat cache', () => {
    it('should cache stat results', () => {
      const mockStats = {
        isFile: () => true,
        isDirectory: () => false,
      } as fs.Stats;

      setCachedStat('/test/file.ts', mockStats);
      const cached = getCachedStat('/test/file.ts');

      expect(cached).not.toBeNull();
      expect(cached?.exists).toBe(true);
      expect(cached?.isFile).toBe(true);
      expect(cached?.isDirectory).toBe(false);
    });

    it('should cache "not exists" results', () => {
      setCachedStat('/test/missing.ts', null);
      const cached = getCachedStat('/test/missing.ts');

      expect(cached).not.toBeNull();
      expect(cached?.exists).toBe(false);
      expect(cached?.isFile).toBe(false);
    });

    it('should clear cache', () => {
      const mockStats = { isFile: () => true, isDirectory: () => false } as fs.Stats;
      setCachedStat('/test/file.ts', mockStats);

      clearStatCache();
      expect(getCachedStat('/test/file.ts')).toBeNull();
    });

    it('should getOrCreateStat from fs when not cached', () => {
      const mockStats = { isFile: () => true, isDirectory: () => false } as fs.Stats;
      vi.mocked(fs.statSync).mockReturnValue(mockStats);

      const result = getOrCreateStat('/test/file.ts');

      expect(result.exists).toBe(true);
      expect(result.isFile).toBe(true);
      expect(fs.statSync).toHaveBeenCalledWith('/test/file.ts');
    });

    it('should getOrCreateStat from cache when available', () => {
      const mockStats = { isFile: () => true, isDirectory: () => false } as fs.Stats;
      setCachedStat('/test/file.ts', mockStats);

      const result = getOrCreateStat('/test/file.ts');

      expect(result.isFile).toBe(true);
      expect(fs.statSync).not.toHaveBeenCalled();
    });

    it('should handle stat errors', () => {
      vi.mocked(fs.statSync).mockImplementation(() => {
        throw new Error('ENOENT');
      });

      const result = getOrCreateStat('/test/missing.ts');

      expect(result.exists).toBe(false);
      expect(result.isFile).toBe(false);
    });
  });

  describe('batchStatAsync', () => {
    it('should stat multiple paths in parallel', async () => {
      const mockStat = vi.mocked(fs.promises.stat);
      mockStat.mockImplementation(async (p) => {
        if (p === '/test/file1.ts') {
          return { isFile: () => true, isDirectory: () => false } as fs.Stats;
        }
        if (p === '/test/file2.ts') {
          return { isFile: () => true, isDirectory: () => false } as fs.Stats;
        }
        throw new Error('ENOENT');
      });

      const results = await batchStatAsync([
        '/test/file1.ts',
        '/test/file2.ts',
        '/test/missing.ts',
      ]);

      expect(results.size).toBe(3);
      expect(results.get('/test/file1.ts')?.isFile).toBe(true);
      expect(results.get('/test/file2.ts')?.isFile).toBe(true);
      expect(results.get('/test/missing.ts')?.exists).toBe(false);
    });

    it('should use cached results', async () => {
      const mockStats = { isFile: () => true, isDirectory: () => false } as fs.Stats;
      setCachedStat('/test/cached.ts', mockStats);

      const mockStat = vi.mocked(fs.promises.stat);
      mockStat.mockResolvedValue({ isFile: () => true, isDirectory: () => false } as fs.Stats);

      const results = await batchStatAsync(['/test/cached.ts', '/test/uncached.ts']);

      expect(results.get('/test/cached.ts')?.isFile).toBe(true);
      expect(results.get('/test/uncached.ts')?.isFile).toBe(true);

      // Only uncached file should trigger fs call
      expect(mockStat).toHaveBeenCalledTimes(1);
      expect(mockStat).toHaveBeenCalledWith('/test/uncached.ts');
    });
  });

  describe('probeFile (sync)', () => {
    it('should find file with exact path when extension includes empty string', () => {
      vi.mocked(fs.statSync).mockImplementation((p) => {
        if (p === '/test/component.tsx') {
          return { isFile: () => true, isDirectory: () => false } as fs.Stats;
        }
        throw new Error('ENOENT');
      });

      // Use TYPESCRIPT_EXTENSIONS which includes '' for exact match
      const result = probeFile('/test/component.tsx', {
        extensions: TYPESCRIPT_EXTENSIONS,
        indexFiles: TYPESCRIPT_INDEX_FILES,
      });
      expect(result).toBe('/test/component.tsx');
    });

    it('should probe extensions in order', () => {
      vi.mocked(fs.statSync).mockImplementation((p) => {
        if (p === '/test/component.tsx') {
          return { isFile: () => true, isDirectory: () => false } as fs.Stats;
        }
        throw new Error('ENOENT');
      });

      const result = probeFile('/test/component', {
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
        indexFiles: [],
      });

      expect(result).toBe('/test/component.tsx');
    });

    it('should find index file in directory', () => {
      vi.mocked(fs.statSync).mockImplementation((p) => {
        if (p === '/test/utils') {
          return { isFile: () => false, isDirectory: () => true } as fs.Stats;
        }
        if (p === '/test/utils/index.ts') {
          return { isFile: () => true, isDirectory: () => false } as fs.Stats;
        }
        throw new Error('ENOENT');
      });

      const result = probeFile('/test/utils', {
        extensions: ['.ts', '.tsx'],
        indexFiles: ['index.ts', 'index.tsx'],
      });

      expect(result).toBe('/test/utils/index.ts');
    });

    it('should skip node_modules by default', () => {
      vi.mocked(fs.statSync).mockReturnValue({
        isFile: () => true,
        isDirectory: () => false,
      } as fs.Stats);

      const result = probeFile('/project/node_modules/lib/index');
      expect(result).toBeNull();
    });

    it('should not skip node_modules when disabled', () => {
      vi.mocked(fs.statSync).mockImplementation((p) => {
        if (p === '/project/node_modules/lib/index.ts') {
          return { isFile: () => true, isDirectory: () => false } as fs.Stats;
        }
        throw new Error('ENOENT');
      });

      const result = probeFile('/project/node_modules/lib/index', {
        extensions: ['.ts'],
        indexFiles: [],
        skipNodeModules: false,
      });

      expect(result).toBe('/project/node_modules/lib/index.ts');
    });

    it('should return null when file not found', () => {
      vi.mocked(fs.statSync).mockImplementation(() => {
        throw new Error('ENOENT');
      });

      const result = probeFile('/test/missing');
      expect(result).toBeNull();
    });
  });

  describe('probeFileAsync', () => {
    it('should find file with extension probing', async () => {
      vi.mocked(fs.promises.stat).mockImplementation(async (p) => {
        if (p === '/test/component.tsx') {
          return { isFile: () => true, isDirectory: () => false } as fs.Stats;
        }
        throw new Error('ENOENT');
      });

      const result = await probeFileAsync('/test/component', {
        extensions: ['.ts', '.tsx'],
        indexFiles: [],
      });

      expect(result).toBe('/test/component.tsx');
    });

    it('should find index file in directory (async)', async () => {
      vi.mocked(fs.promises.stat).mockImplementation(async (p) => {
        if (p === '/test/utils' || p === '/test/utils/') {
          return { isFile: () => false, isDirectory: () => true } as fs.Stats;
        }
        if (p === '/test/utils/index.tsx') {
          return { isFile: () => true, isDirectory: () => false } as fs.Stats;
        }
        throw new Error('ENOENT');
      });

      const result = await probeFileAsync('/test/utils', {
        extensions: [''], // Include empty string to get directory check
        indexFiles: ['index.ts', 'index.tsx'],
      });

      expect(result).toBe('/test/utils/index.tsx');
    });

    it('should skip node_modules by default (async)', async () => {
      vi.mocked(fs.promises.stat).mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
      } as fs.Stats);

      const result = await probeFileAsync('/project/node_modules/lib/index');
      expect(result).toBeNull();
    });
  });

  describe('convenience functions', () => {
    it('probeTypeScriptFile should use TypeScript extensions', () => {
      vi.mocked(fs.statSync).mockImplementation((p) => {
        if (p === '/test/module.mjs') {
          return { isFile: () => true, isDirectory: () => false } as fs.Stats;
        }
        throw new Error('ENOENT');
      });

      const result = probeTypeScriptFile('/test/module');
      expect(result).toBe('/test/module.mjs');
    });

    it('probeTypeScriptFile should NOT skip node_modules', () => {
      vi.mocked(fs.statSync).mockImplementation((p) => {
        if (p === '/project/node_modules/lib/index.ts') {
          return { isFile: () => true, isDirectory: () => false } as fs.Stats;
        }
        throw new Error('ENOENT');
      });

      const result = probeTypeScriptFile('/project/node_modules/lib/index');
      expect(result).toBe('/project/node_modules/lib/index.ts');
    });

    it('probeModuleFile should use FILE_PROBE extensions including MDX', () => {
      vi.mocked(fs.statSync).mockImplementation((p) => {
        if (p === '/test/doc.mdx') {
          return { isFile: () => true, isDirectory: () => false } as fs.Stats;
        }
        throw new Error('ENOENT');
      });

      const result = probeModuleFile('/test/doc');
      expect(result).toBe('/test/doc.mdx');
    });

    it('probeModuleFile should skip node_modules', () => {
      vi.mocked(fs.statSync).mockReturnValue({
        isFile: () => true,
        isDirectory: () => false,
      } as fs.Stats);

      const result = probeModuleFile('/project/node_modules/lib/index');
      expect(result).toBeNull();
    });

    it('probeTypeScriptFileAsync should work', async () => {
      vi.mocked(fs.promises.stat).mockImplementation(async (p) => {
        if (p === '/test/module.json') {
          return { isFile: () => true, isDirectory: () => false } as fs.Stats;
        }
        throw new Error('ENOENT');
      });

      const result = await probeTypeScriptFileAsync('/test/module');
      expect(result).toBe('/test/module.json');
    });

    it('probeModuleFileAsync should work', async () => {
      vi.mocked(fs.promises.stat).mockImplementation(async (p) => {
        if (p === '/test/readme.md') {
          return { isFile: () => true, isDirectory: () => false } as fs.Stats;
        }
        throw new Error('ENOENT');
      });

      const result = await probeModuleFileAsync('/test/readme');
      expect(result).toBe('/test/readme.md');
    });
  });

  describe('cache TTL behavior', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should expire cached stat after TTL', () => {
      const mockStats = { isFile: () => true, isDirectory: () => false } as fs.Stats;
      setCachedStat('/test/file.ts', mockStats);

      expect(getCachedStat('/test/file.ts')).not.toBeNull();

      // Advance past TTL (5000ms)
      vi.advanceTimersByTime(5100);

      expect(getCachedStat('/test/file.ts')).toBeNull();
    });

    it('should return fresh stat after cache expires', () => {
      const mockStats1 = { isFile: () => true, isDirectory: () => false } as fs.Stats;
      const mockStats2 = { isFile: () => false, isDirectory: () => true } as fs.Stats;

      // First call - caches file
      vi.mocked(fs.statSync).mockReturnValue(mockStats1);
      const result1 = getOrCreateStat('/test/path');
      expect(result1.isFile).toBe(true);

      // Second call within TTL - uses cache
      vi.mocked(fs.statSync).mockReturnValue(mockStats2);
      const result2 = getOrCreateStat('/test/path');
      expect(result2.isFile).toBe(true); // Still cached
      expect(fs.statSync).toHaveBeenCalledTimes(1);

      // Advance past TTL
      vi.advanceTimersByTime(5100);

      // Third call - fresh stat
      const result3 = getOrCreateStat('/test/path');
      expect(result3.isDirectory).toBe(true); // New value
      expect(fs.statSync).toHaveBeenCalledTimes(2);
    });
  });

  describe('extension priority', () => {
    it('should respect extension priority order', () => {
      const callOrder: string[] = [];

      vi.mocked(fs.statSync).mockImplementation((p) => {
        callOrder.push(p as string);
        // All files exist - should return first match
        if ((p as string).endsWith('.ts') || (p as string).endsWith('.tsx')) {
          return { isFile: () => true, isDirectory: () => false } as fs.Stats;
        }
        throw new Error('ENOENT');
      });

      const result = probeFile('/test/component', {
        extensions: ['.ts', '.tsx', '.js'],
        indexFiles: [],
      });

      // Should return .ts (first match) even though .tsx also exists
      expect(result).toBe('/test/component.ts');
    });

    it('should respect index file priority order', () => {
      vi.mocked(fs.statSync).mockImplementation((p) => {
        if (p === '/test/utils') {
          return { isFile: () => false, isDirectory: () => true } as fs.Stats;
        }
        // Both index.ts and index.tsx exist
        if (
          p === '/test/utils/index.ts' ||
          p === '/test/utils/index.tsx'
        ) {
          return { isFile: () => true, isDirectory: () => false } as fs.Stats;
        }
        throw new Error('ENOENT');
      });

      const result = probeFile('/test/utils', {
        extensions: ['.ts', '.tsx'],
        indexFiles: ['index.ts', 'index.tsx'],
      });

      // Should return index.ts (first in priority)
      expect(result).toBe('/test/utils/index.ts');
    });
  });
});
