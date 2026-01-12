import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import {
  isLocalImport,
  resolveImportAsync,
  resolveImportSync,
} from '../module-fetcher/resolve-import';

// mock fs module
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof fs>('fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    statSync: vi.fn(),
    promises: {
      stat: vi.fn(),
      access: vi.fn(),
    },
  };
});

// mock logging
vi.mock('../logging', () => ({
  debug: vi.fn(),
}));

import { debug } from '../logging';

describe('resolve-import', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isLocalImport', () => {
    it('should return true for relative imports starting with ./', () => {
      expect(isLocalImport('./Component')).toBe(true);
      expect(isLocalImport('./utils/helpers')).toBe(true);
    });

    it('should return true for relative imports starting with ../', () => {
      expect(isLocalImport('../Component')).toBe(true);
      expect(isLocalImport('../../utils/helpers')).toBe(true);
    });

    it('should return false for package imports', () => {
      expect(isLocalImport('react')).toBe(false);
      expect(isLocalImport('@org/package')).toBe(false);
      expect(isLocalImport('lodash/debounce')).toBe(false);
    });

    it('should return false for absolute paths', () => {
      expect(isLocalImport('/absolute/path')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isLocalImport('')).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(isLocalImport(null as any)).toBe(false);
      expect(isLocalImport(undefined as any)).toBe(false);
    });

    it('should return false for http/https URLs', () => {
      expect(isLocalImport('http://example.com/module.js')).toBe(false);
      expect(isLocalImport('https://cdn.example.com/lib.js')).toBe(false);
    });

    it('should return false for npm:// URLs', () => {
      expect(isLocalImport('npm://package-name')).toBe(false);
      expect(isLocalImport('npm://scoped/package')).toBe(false);
    });
  });

  describe('resolveImportAsync', () => {
    it('should resolve exact file path if it exists', async () => {
      vi.mocked(fs.promises.stat).mockResolvedValueOnce({
        isFile: () => true,
      } as fs.Stats);

      const result = await resolveImportAsync('/workspace/src', './Component');
      expect(result).toBe('/workspace/src/Component');
    });

    it('should try extensions if exact path is a directory', async () => {
      // First stat call returns directory
      vi.mocked(fs.promises.stat).mockResolvedValueOnce({
        isFile: () => false,
      } as fs.Stats);
      // access calls for extensions - .ts succeeds
      vi.mocked(fs.promises.access).mockRejectedValueOnce(new Error()); // .ts fails
      vi.mocked(fs.promises.access).mockResolvedValueOnce(undefined); // .tsx succeeds

      const result = await resolveImportAsync('/workspace/src', './Component');
      expect(result).toBe('/workspace/src/Component.tsx');
    });

    it('should try index files for directory imports', async () => {
      // stat throws (doesn't exist)
      vi.mocked(fs.promises.stat).mockRejectedValueOnce(new Error());
      // all extension access calls fail
      vi.mocked(fs.promises.access)
        .mockRejectedValueOnce(new Error()) // .ts
        .mockRejectedValueOnce(new Error()) // .tsx
        .mockRejectedValueOnce(new Error()) // .js
        .mockRejectedValueOnce(new Error()) // .jsx
        .mockRejectedValueOnce(new Error()) // .mdx
        .mockRejectedValueOnce(new Error()) // .md
        // index file access calls
        .mockRejectedValueOnce(new Error()) // index.ts
        .mockResolvedValueOnce(undefined); // index.tsx succeeds

      const result = await resolveImportAsync('/workspace/src', './utils');
      expect(result).toBe('/workspace/src/utils/index.tsx');
    });

    it('should return null for node_modules paths', async () => {
      const result = await resolveImportAsync(
        '/workspace/node_modules/react',
        './Component'
      );
      expect(result).toBeNull();
    });

    it('should return null if no file found', async () => {
      vi.mocked(fs.promises.stat).mockRejectedValue(new Error());
      vi.mocked(fs.promises.access).mockRejectedValue(new Error());

      const result = await resolveImportAsync('/workspace/src', './NotFound');
      expect(result).toBeNull();
    });

    it('should use custom extensions if provided', async () => {
      vi.mocked(fs.promises.stat).mockRejectedValueOnce(new Error());
      vi.mocked(fs.promises.access)
        .mockRejectedValueOnce(new Error()) // .vue fails
        .mockResolvedValueOnce(undefined); // .svelte succeeds

      const result = await resolveImportAsync('/workspace/src', './Component', {
        extensions: ['.vue', '.svelte'],
      });
      expect(result).toBe('/workspace/src/Component.svelte');
    });
  });

  describe('resolveImportSync', () => {
    it('should resolve exact file path if it exists', () => {
      vi.mocked(fs.statSync).mockReturnValueOnce({
        isFile: () => true,
      } as fs.Stats);

      const result = resolveImportSync('/workspace/src', './Component');
      expect(result).toBe('/workspace/src/Component');
    });

    it('should try extensions if exact path does not exist', () => {
      // statSync: throws for exact path, returns file for .tsx path
      vi.mocked(fs.statSync).mockImplementation((p) => {
        const pathStr = String(p);
        if (pathStr.endsWith('.tsx')) {
          return { isFile: () => true } as fs.Stats;
        }
        throw new Error('ENOENT');
      });

      const result = resolveImportSync('/workspace/src', './Component');
      expect(result).toBe('/workspace/src/Component.tsx');
    });

    it('should try index files for directory imports', () => {
      // statSync: returns file only for index.tsx
      vi.mocked(fs.statSync).mockImplementation((p) => {
        const pathStr = String(p);
        if (pathStr.endsWith('/utils/index.tsx')) {
          return { isFile: () => true } as fs.Stats;
        }
        throw new Error('ENOENT');
      });

      const result = resolveImportSync('/workspace/src', './utils');
      expect(result).toBe('/workspace/src/utils/index.tsx');
    });

    it('should return null for node_modules paths', () => {
      const result = resolveImportSync(
        '/workspace/node_modules/react',
        './index'
      );
      expect(result).toBeNull();
    });

    it('should return null if no file found', () => {
      vi.mocked(fs.statSync).mockImplementation(() => {
        throw new Error('ENOENT');
      });

      const result = resolveImportSync('/workspace/src', './NotFound');
      expect(result).toBeNull();
    });
  });

  describe('extension ordering', () => {
    it('should try extensions in correct order for async', async () => {
      vi.mocked(fs.promises.stat).mockRejectedValue(new Error());
      vi.mocked(fs.promises.access).mockRejectedValue(new Error());

      await resolveImportAsync('/workspace/src', './Component');

      // Verify access was called with extensions in order
      const accessCalls = vi.mocked(fs.promises.access).mock.calls;
      expect(accessCalls[0][0]).toBe('/workspace/src/Component.ts');
      expect(accessCalls[1][0]).toBe('/workspace/src/Component.tsx');
      expect(accessCalls[2][0]).toBe('/workspace/src/Component.js');
      expect(accessCalls[3][0]).toBe('/workspace/src/Component.jsx');
      expect(accessCalls[4][0]).toBe('/workspace/src/Component.mdx');
      expect(accessCalls[5][0]).toBe('/workspace/src/Component.md');
    });

    it('should try index extensions in correct order', async () => {
      vi.mocked(fs.promises.stat).mockRejectedValue(new Error());
      vi.mocked(fs.promises.access).mockRejectedValue(new Error());

      await resolveImportAsync('/workspace/src', './utils');

      const accessCalls = vi.mocked(fs.promises.access).mock.calls;
      // After 6 extension calls, index files are tried
      expect(accessCalls[6][0]).toBe('/workspace/src/utils/index.ts');
      expect(accessCalls[7][0]).toBe('/workspace/src/utils/index.tsx');
      expect(accessCalls[8][0]).toBe('/workspace/src/utils/index.js');
      expect(accessCalls[9][0]).toBe('/workspace/src/utils/index.jsx');
    });
  });

  describe('node_modules handling', () => {
    it('should skip paths that would resolve into node_modules (async)', async () => {
      const result = await resolveImportAsync(
        '/workspace/src',
        '../node_modules/package/index'
      );
      expect(result).toBeNull();
      expect(fs.promises.stat).not.toHaveBeenCalled();
    });

    it('should skip paths that would resolve into node_modules (sync)', () => {
      const result = resolveImportSync(
        '/workspace/src',
        '../node_modules/package/index'
      );
      expect(result).toBeNull();
      expect(fs.statSync).not.toHaveBeenCalled();
    });
  });

  describe('debug logging', () => {
    it('should log debug message when async resolution fails', async () => {
      vi.mocked(fs.promises.stat).mockRejectedValue(new Error());
      vi.mocked(fs.promises.access).mockRejectedValue(new Error());

      const result = await resolveImportAsync('/workspace/src', './NotFound');

      expect(result).toBeNull();
      expect(debug).toHaveBeenCalledWith(
        expect.stringContaining('[RESOLVE-IMPORT] Could not resolve import')
      );
      expect(debug).toHaveBeenCalledWith(expect.stringContaining('./NotFound'));
    });

    it('should log debug message when sync resolution fails', () => {
      vi.mocked(fs.statSync).mockImplementation(() => {
        throw new Error('ENOENT');
      });

      const result = resolveImportSync('/workspace/src', './NotFound');

      expect(result).toBeNull();
      expect(debug).toHaveBeenCalledWith(
        expect.stringContaining('[RESOLVE-IMPORT] Could not resolve import')
      );
      expect(debug).toHaveBeenCalledWith(expect.stringContaining('./NotFound'));
    });

    it('should not log debug when resolution succeeds', async () => {
      vi.mocked(fs.promises.stat).mockResolvedValueOnce({
        isFile: () => true,
      } as fs.Stats);

      const result = await resolveImportAsync('/workspace/src', './Component');

      expect(result).toBe('/workspace/src/Component');
      expect(debug).not.toHaveBeenCalled();
    });
  });
});
