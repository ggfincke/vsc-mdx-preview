import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import * as vscode from 'vscode';
import {
  __setMockWorkspaceFolders,
  __resetMocks,
  Uri,
} from './__mocks__/vscode';
import { TailwindDetector } from '../tailwind';

vi.mock('fs');
vi.mock('../logging', () => ({
  debug: vi.fn(),
}));
vi.mock('../module-fetcher/resolver-factory', () => ({
  getNodeResolver: vi.fn(() => ({
    resolveSync: vi.fn(),
  })),
}));

import { getNodeResolver } from '../module-fetcher/resolver-factory';

describe('TailwindDetector', () => {
  let detector: TailwindDetector;

  beforeEach(() => {
    vi.clearAllMocks();
    __resetMocks();
    detector = new TailwindDetector();
  });

  describe('resolveWorkspaceRoot', () => {
    it('should return workspace folder containing docUri', () => {
      __setMockWorkspaceFolders([{ uri: { fsPath: '/workspace' } }]);

      const docUri = Uri.file('/workspace/src/page.mdx');
      const result = detector.resolveWorkspaceRoot({ docUri });

      expect(result).toBe('/workspace');
    });

    it('should return null when no workspace open', () => {
      __setMockWorkspaceFolders([]);

      const docUri = Uri.file('/outside/page.mdx');
      const result = detector.resolveWorkspaceRoot({ docUri });

      expect(result).toBeNull();
    });

    it('should handle multi-root workspaces', () => {
      __setMockWorkspaceFolders([
        { uri: { fsPath: '/workspace-a' } },
        { uri: { fsPath: '/workspace-b' } },
      ]);

      const docUri = Uri.file('/workspace-b/src/page.mdx');
      const result = detector.resolveWorkspaceRoot({ docUri });

      expect(result).toBe('/workspace-b');
    });

    it('should use entryDir to find workspace when docUri does not match', () => {
      __setMockWorkspaceFolders([{ uri: { fsPath: '/workspace' } }]);

      // create a Uri w/ non-file scheme
      const docUri = {
        scheme: 'untitled',
        fsPath: '/temp/untitled.mdx',
        path: '/temp/untitled.mdx',
      } as vscode.Uri;

      const result = detector.resolveWorkspaceRoot({
        docUri,
        entryDir: '/workspace/src',
      });

      expect(result).toBe('/workspace');
    });

    it('should fall back to first workspace folder when no match', () => {
      __setMockWorkspaceFolders([{ uri: { fsPath: '/fallback-workspace' } }]);

      const docUri = {
        scheme: 'untitled',
        fsPath: '/outside/page.mdx',
        path: '/outside/page.mdx',
      } as vscode.Uri;

      const result = detector.resolveWorkspaceRoot({
        docUri,
        entryDir: '/also-outside',
      });

      expect(result).toBe('/fallback-workspace');
    });
  });

  describe('resolveConfigPath', () => {
    it('should find tailwind.config.js in entry directory', () => {
      vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
        return p === '/workspace/src/tailwind.config.js';
      });

      const result = detector.resolveConfigPath({
        entryDir: '/workspace/src',
        workspaceRoot: '/workspace',
      });

      expect(result).toBe('/workspace/src/tailwind.config.js');
    });

    it('should find tailwind.config.ts when .js does not exist', () => {
      vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
        return p === '/workspace/tailwind.config.ts';
      });

      const result = detector.resolveConfigPath({
        entryDir: '/workspace/src',
        workspaceRoot: '/workspace',
      });

      expect(result).toBe('/workspace/tailwind.config.ts');
    });

    it('should walk upward to workspace root', () => {
      vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
        return p === '/workspace/tailwind.config.js';
      });

      const result = detector.resolveConfigPath({
        entryDir: '/workspace/src/deep/nested',
        workspaceRoot: '/workspace',
      });

      expect(result).toBe('/workspace/tailwind.config.js');
    });

    it('should respect configOverride with absolute path', () => {
      vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
        return p === '/custom/path/tailwind.config.js';
      });

      const result = detector.resolveConfigPath({
        entryDir: '/workspace/src',
        workspaceRoot: '/workspace',
        configOverride: '/custom/path/tailwind.config.js',
      });

      expect(result).toBe('/custom/path/tailwind.config.js');
    });

    it('should respect configOverride with relative path resolved from configDir', () => {
      vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
        return p === '/workspace/config/tailwind.config.js';
      });

      const result = detector.resolveConfigPath({
        entryDir: '/workspace/src',
        workspaceRoot: '/workspace',
        configOverride: './tailwind.config.js',
        configDir: '/workspace/config',
      });

      expect(result).toBe('/workspace/config/tailwind.config.js');
    });

    it('should return null when no config found', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);

      const result = detector.resolveConfigPath({
        entryDir: '/workspace/src',
        workspaceRoot: '/workspace',
      });

      expect(result).toBeNull();
    });

    it('should cache config path', () => {
      const existsSpy = vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
        return p === '/workspace/tailwind.config.js';
      });

      // First call
      detector.resolveConfigPath({
        entryDir: '/workspace/src',
        workspaceRoot: '/workspace',
      });
      expect(existsSpy).toHaveBeenCalled();

      // Clear mock call history
      existsSpy.mockClear();

      // Second call should use cache
      const result = detector.resolveConfigPath({
        entryDir: '/workspace/src',
        workspaceRoot: '/workspace',
      });
      expect(result).toBe('/workspace/tailwind.config.js');
      // existsSync is called once to validate cache, but config search is skipped
      expect(existsSpy).toHaveBeenCalledTimes(1);
    });

    it('should invalidate cache when file deleted', () => {
      let fileExists = true;
      vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
        if (p === '/workspace/tailwind.config.js') {
          return fileExists;
        }
        return false;
      });

      // First call - file exists
      const result1 = detector.resolveConfigPath({
        entryDir: '/workspace/src',
        workspaceRoot: '/workspace',
      });
      expect(result1).toBe('/workspace/tailwind.config.js');

      // Simulate file deletion
      fileExists = false;

      // Second call - cache should be invalidated
      const result2 = detector.resolveConfigPath({
        entryDir: '/workspace/src',
        workspaceRoot: '/workspace',
      });
      expect(result2).toBeNull();
    });

    it('should return null when no search directories provided', () => {
      const result = detector.resolveConfigPath({});
      expect(result).toBeNull();
    });
  });

  describe('resolveEntryCssPath', () => {
    it('should find CSS with @import tailwindcss', async () => {
      const cssUri = Uri.file('/workspace/src/styles.css');
      vi.mocked(vscode.workspace.findFiles).mockResolvedValue([cssUri]);
      // Mock to only return Tailwind content for the expected file
      vi.spyOn(fs.promises, 'readFile').mockImplementation(async (filePath) => {
        if (filePath === '/workspace/src/styles.css') {
          return '@import "tailwindcss";\n.custom { color: red; }';
        }
        throw new Error('ENOENT');
      });
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);

      const result = await detector.resolveEntryCssPath({
        workspaceRoot: '/workspace',
        entryDir: '/workspace/src',
      });

      expect(result).toBe('/workspace/src/styles.css');
    });

    it('should find CSS with @import tailwindcss/preflight', async () => {
      const cssUri = Uri.file('/workspace/globals.css');
      vi.mocked(vscode.workspace.findFiles).mockResolvedValue([cssUri]);
      // Mock to only return Tailwind content for the expected file
      vi.spyOn(fs.promises, 'readFile').mockImplementation(async (filePath) => {
        if (filePath === '/workspace/globals.css') {
          return "@import 'tailwindcss/preflight';";
        }
        throw new Error('ENOENT');
      });
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);

      const result = await detector.resolveEntryCssPath({
        workspaceRoot: '/workspace',
        entryDir: null,
      });

      expect(result).toBe('/workspace/globals.css');
    });

    it('should find CSS with @tailwind base directive', async () => {
      const cssUri = Uri.file('/workspace/app.css');
      vi.mocked(vscode.workspace.findFiles).mockResolvedValue([cssUri]);
      // Mock to only return Tailwind content for the expected file
      vi.spyOn(fs.promises, 'readFile').mockImplementation(async (filePath) => {
        if (filePath === '/workspace/app.css') {
          return '@tailwind base;\n@tailwind components;\n@tailwind utilities;';
        }
        throw new Error('ENOENT');
      });
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);

      const result = await detector.resolveEntryCssPath({
        workspaceRoot: '/workspace',
        entryDir: null,
      });

      expect(result).toBe('/workspace/app.css');
    });

    it('should find CSS with @tailwind utilities directive', async () => {
      const cssUri = Uri.file('/workspace/main.css');
      vi.mocked(vscode.workspace.findFiles).mockResolvedValue([cssUri]);
      // Mock to only return Tailwind content for the expected file
      vi.spyOn(fs.promises, 'readFile').mockImplementation(async (filePath) => {
        if (filePath === '/workspace/main.css') {
          return '@tailwind utilities;';
        }
        throw new Error('ENOENT');
      });
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);

      const result = await detector.resolveEntryCssPath({
        workspaceRoot: '/workspace',
        entryDir: null,
      });

      expect(result).toBe('/workspace/main.css');
    });

    it('should return null when no CSS files found', async () => {
      vi.mocked(vscode.workspace.findFiles).mockResolvedValue([]);

      const result = await detector.resolveEntryCssPath({
        workspaceRoot: '/workspace',
        entryDir: null,
      });

      expect(result).toBeNull();
    });

    it('should return null when CSS files do not contain Tailwind directives', async () => {
      const cssUri = Uri.file('/workspace/styles.css');
      vi.mocked(vscode.workspace.findFiles).mockResolvedValue([cssUri]);
      vi.spyOn(fs.promises, 'readFile').mockResolvedValue(
        '.btn { color: blue; }'
      );

      const result = await detector.resolveEntryCssPath({
        workspaceRoot: '/workspace',
        entryDir: null,
      });

      expect(result).toBeNull();
    });

    it('should return null when workspaceRoot is null', async () => {
      const result = await detector.resolveEntryCssPath({
        workspaceRoot: null,
        entryDir: null,
      });
      expect(result).toBeNull();
    });

    it('should cache entry CSS path', async () => {
      const cssUri = Uri.file('/workspace/styles.css');
      vi.mocked(vscode.workspace.findFiles).mockResolvedValue([cssUri]);
      // Mock to only return Tailwind content for the expected file
      vi.spyOn(fs.promises, 'readFile').mockImplementation(async (filePath) => {
        if (filePath === '/workspace/styles.css') {
          return '@tailwind base;';
        }
        throw new Error('ENOENT');
      });
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);

      // First call
      await detector.resolveEntryCssPath({
        workspaceRoot: '/workspace',
        entryDir: null,
      });

      // Clear mock call history
      vi.mocked(vscode.workspace.findFiles).mockClear();

      // Second call should use cache
      const result = await detector.resolveEntryCssPath({
        workspaceRoot: '/workspace',
        entryDir: null,
      });
      expect(result).toBe('/workspace/styles.css');
      expect(vscode.workspace.findFiles).not.toHaveBeenCalled();
    });

    it('should skip unreadable files gracefully', async () => {
      const cssUri1 = Uri.file('/workspace/unreadable.css');
      const cssUri2 = Uri.file('/workspace/readable.css');
      vi.mocked(vscode.workspace.findFiles).mockResolvedValue([
        cssUri1,
        cssUri2,
      ]);
      // mock to throw ENOENT for common locations, EACCES for unreadable, & return Tailwind for readable
      vi.spyOn(fs.promises, 'readFile').mockImplementation(async (filePath) => {
        if (filePath === '/workspace/unreadable.css') {
          throw new Error('EACCES');
        }
        if (filePath === '/workspace/readable.css') {
          return '@tailwind base;';
        }
        // All other paths (common locations) should throw ENOENT
        throw new Error('ENOENT');
      });
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);

      const result = await detector.resolveEntryCssPath({
        workspaceRoot: '/workspace',
        entryDir: null,
      });

      expect(result).toBe('/workspace/readable.css');
    });
  });

  describe('getWorkspaceTailwindVersion', () => {
    it('should detect v3.x from package.json', () => {
      const mockResolver = {
        resolveSync: vi
          .fn()
          .mockReturnValue('/workspace/node_modules/tailwindcss/package.json'),
      };
      vi.mocked(getNodeResolver).mockReturnValue(mockResolver as never);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify({ version: '3.4.1' })
      );

      const result = detector.getWorkspaceTailwindVersion('/workspace');

      expect(result.version).toBe('3.4.1');
      expect(result.major).toBe(3);
      expect(result.modulePath).toBe('/workspace/node_modules/tailwindcss');
    });

    it('should detect v4.x from package.json', () => {
      const mockResolver = {
        resolveSync: vi
          .fn()
          .mockReturnValue('/workspace/node_modules/tailwindcss/package.json'),
      };
      vi.mocked(getNodeResolver).mockReturnValue(mockResolver as never);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify({ version: '4.0.0-beta.1' })
      );

      const result = detector.getWorkspaceTailwindVersion('/workspace');

      expect(result.version).toBe('4.0.0-beta.1');
      expect(result.major).toBe(4);
    });

    it('should return null version when tailwindcss not found', () => {
      const mockResolver = {
        resolveSync: vi.fn().mockImplementation(() => {
          throw new Error('Module not found');
        }),
      };
      vi.mocked(getNodeResolver).mockReturnValue(mockResolver as never);

      const result = detector.getWorkspaceTailwindVersion('/workspace');

      expect(result.version).toBeNull();
      expect(result.major).toBeNull();
    });

    it('should cache version per workspace', () => {
      const mockResolver = {
        resolveSync: vi
          .fn()
          .mockReturnValue('/workspace/node_modules/tailwindcss/package.json'),
      };
      vi.mocked(getNodeResolver).mockReturnValue(mockResolver as never);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify({ version: '3.4.1' })
      );

      // First call
      detector.getWorkspaceTailwindVersion('/workspace');

      // Clear mocks
      mockResolver.resolveSync.mockClear();

      // Second call should use cache
      const result = detector.getWorkspaceTailwindVersion('/workspace');
      expect(result.version).toBe('3.4.1');
      expect(mockResolver.resolveSync).not.toHaveBeenCalled();
    });

    it('should handle missing version field in package.json', () => {
      const mockResolver = {
        resolveSync: vi
          .fn()
          .mockReturnValue('/workspace/node_modules/tailwindcss/package.json'),
      };
      vi.mocked(getNodeResolver).mockReturnValue(mockResolver as never);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify({ name: 'tailwindcss' })
      );

      const result = detector.getWorkspaceTailwindVersion('/workspace');

      expect(result.version).toBeNull();
      expect(result.major).toBeNull();
    });

    it('should handle invalid version string', () => {
      const mockResolver = {
        resolveSync: vi
          .fn()
          .mockReturnValue('/workspace/node_modules/tailwindcss/package.json'),
      };
      vi.mocked(getNodeResolver).mockReturnValue(mockResolver as never);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify({ version: 'invalid' })
      );

      const result = detector.getWorkspaceTailwindVersion('/workspace');

      expect(result.version).toBe('invalid');
      expect(result.major).toBeNull(); // NaN becomes null
    });

    it('should handle null workspaceRoot', () => {
      const mockResolver = {
        resolveSync: vi.fn(),
      };
      vi.mocked(getNodeResolver).mockReturnValue(mockResolver as never);

      const result = detector.getWorkspaceTailwindVersion(null);

      expect(result.version).toBeNull();
      expect(result.major).toBeNull();
      expect(mockResolver.resolveSync).not.toHaveBeenCalled();
    });

    it('should handle false return from resolver', () => {
      const mockResolver = {
        resolveSync: vi.fn().mockReturnValue(false),
      };
      vi.mocked(getNodeResolver).mockReturnValue(mockResolver as never);

      const result = detector.getWorkspaceTailwindVersion('/workspace');

      expect(result.version).toBeNull();
      expect(result.major).toBeNull();
    });

    it('should return cached version within TTL', () => {
      const mockResolver = {
        resolveSync: vi
          .fn()
          .mockReturnValue('/workspace/node_modules/tailwindcss/package.json'),
      };
      vi.mocked(getNodeResolver).mockReturnValue(mockResolver as never);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify({ version: '3.4.1' })
      );

      // First call - populates cache
      detector.getWorkspaceTailwindVersion('/workspace');

      // Clear mock
      mockResolver.resolveSync.mockClear();

      // Second call within TTL - should use cache
      const result = detector.getWorkspaceTailwindVersion('/workspace');
      expect(result.version).toBe('3.4.1');
      expect(mockResolver.resolveSync).not.toHaveBeenCalled();
    });

    it('should re-resolve after TTL expires', () => {
      vi.useFakeTimers();

      const mockResolver = {
        resolveSync: vi
          .fn()
          .mockReturnValue('/workspace/node_modules/tailwindcss/package.json'),
      };
      vi.mocked(getNodeResolver).mockReturnValue(mockResolver as never);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify({ version: '3.4.1' })
      );

      // First call
      detector.getWorkspaceTailwindVersion('/workspace');
      mockResolver.resolveSync.mockClear();

      // Advance time past TTL (5 minutes + 1ms)
      vi.advanceTimersByTime(5 * 60 * 1000 + 1);

      // Should re-resolve after TTL expires
      detector.getWorkspaceTailwindVersion('/workspace');
      expect(mockResolver.resolveSync).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should invalidate cache when invalidateVersionCache called with workspace', () => {
      const mockResolver = {
        resolveSync: vi
          .fn()
          .mockReturnValue('/workspace/node_modules/tailwindcss/package.json'),
      };
      vi.mocked(getNodeResolver).mockReturnValue(mockResolver as never);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify({ version: '3.4.1' })
      );

      // Populate cache
      detector.getWorkspaceTailwindVersion('/workspace');
      mockResolver.resolveSync.mockClear();

      // Invalidate
      detector.invalidateVersionCache('/workspace');

      // Should re-resolve
      detector.getWorkspaceTailwindVersion('/workspace');
      expect(mockResolver.resolveSync).toHaveBeenCalled();
    });

    it('should invalidate all caches when invalidateVersionCache called without argument', () => {
      const mockResolver = {
        resolveSync: vi
          .fn()
          .mockReturnValue('/workspace/node_modules/tailwindcss/package.json'),
      };
      vi.mocked(getNodeResolver).mockReturnValue(mockResolver as never);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify({ version: '3.4.1' })
      );

      // Populate caches for two workspaces
      detector.getWorkspaceTailwindVersion('/workspace-a');
      detector.getWorkspaceTailwindVersion('/workspace-b');
      mockResolver.resolveSync.mockClear();

      // Invalidate all
      detector.invalidateVersionCache();

      // Both should re-resolve
      detector.getWorkspaceTailwindVersion('/workspace-a');
      detector.getWorkspaceTailwindVersion('/workspace-b');
      expect(mockResolver.resolveSync).toHaveBeenCalledTimes(2);
    });
  });
});
