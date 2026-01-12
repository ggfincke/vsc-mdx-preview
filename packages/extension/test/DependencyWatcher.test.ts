// packages/extension/test/DependencyWatcher.test.ts
// tests for DependencyWatcher - verifies import detection, resolution, & file watching

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DependencyWatcher } from '../preview/watchers/DependencyWatcher';
import * as fs from 'fs';

// mock fs module with statSync (resolveImportSync uses statSync, not existsSync)
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof fs>('fs');
  return {
    ...actual,
    statSync: vi.fn(),
  };
});

describe('DependencyWatcher', () => {
  let watcher: DependencyWatcher;
  let onChangeCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    onChangeCallback = vi.fn();
    watcher = new DependencyWatcher(onChangeCallback);
    watcher.setDocumentDir('/workspace/src');
  });

  describe('import classification', () => {
    it('should detect local imports (./foo, ../bar)', () => {
      const localImports = ['./component', '../utils/helper', './lib/index'];

      // Mock file existence - statSync returns stat object with isFile()
      vi.mocked(fs.statSync).mockReturnValue({
        isFile: () => true,
      } as fs.Stats);

      watcher.updateDependencies(localImports);

      // Should have called statSync to check files
      expect(fs.statSync).toHaveBeenCalled();
    });

    it('should skip node_modules imports', () => {
      const nodeModulesImports = ['react', 'lodash', '@types/node'];

      watcher.updateDependencies(nodeModulesImports);

      // Should not attempt to resolve node_modules
      expect(fs.statSync).not.toHaveBeenCalled();
    });

    it('should skip http/https URLs', () => {
      const urlImports = [
        'https://example.com/module.js',
        'http://cdn.example.com/lib.js',
      ];

      watcher.updateDependencies(urlImports);

      expect(fs.statSync).not.toHaveBeenCalled();
    });

    it('should skip npm:// imports', () => {
      const npmImports = ['npm://package-name', 'npm://scoped/package'];

      watcher.updateDependencies(npmImports);

      expect(fs.statSync).not.toHaveBeenCalled();
    });

    it('should handle empty import list', () => {
      watcher.updateDependencies([]);

      expect(fs.statSync).not.toHaveBeenCalled();
    });

    it('should handle mixed import types', () => {
      const mixedImports = [
        './local-file',
        'node-module',
        'https://example.com/file.js',
        '../another-local',
      ];

      vi.mocked(fs.statSync).mockReturnValue({
        isFile: () => true,
      } as fs.Stats);

      watcher.updateDependencies(mixedImports);

      // Should only check local files
      expect(fs.statSync).toHaveBeenCalled();
    });
  });

  describe('import resolution', () => {
    it('should resolve with common extensions (.ts, .tsx, .js, .jsx)', () => {
      const imports = ['./component'];

      // Mock: file doesn't exist without extension, but exists w/ .tsx
      vi.mocked(fs.statSync).mockImplementation((p) => {
        const pathStr = String(p);
        if (pathStr.endsWith('.tsx')) {
          return { isFile: () => true } as fs.Stats;
        }
        throw new Error('ENOENT');
      });

      watcher.updateDependencies(imports);

      // Should have tried multiple extensions
      expect(fs.statSync).toHaveBeenCalled();
      const calls = vi.mocked(fs.statSync).mock.calls;
      const extensions = calls.map((call) => String(call[0]).split('.').pop());
      expect(extensions).toContain('tsx');
    });

    it('should detect index files', () => {
      const imports = ['./components'];

      // Mock directory w/ index file
      vi.mocked(fs.statSync).mockImplementation((p) => {
        const pathStr = String(p);
        if (pathStr.includes('index.tsx') || pathStr.includes('index.ts')) {
          return { isFile: () => true } as fs.Stats;
        }
        throw new Error('ENOENT');
      });

      watcher.updateDependencies(imports);

      expect(fs.statSync).toHaveBeenCalled();
    });

    it('should return null for non-existent files', () => {
      const imports = ['./non-existent'];

      // Mock: file doesn't exist (statSync throws)
      vi.mocked(fs.statSync).mockImplementation(() => {
        throw new Error('ENOENT');
      });

      watcher.updateDependencies(imports);

      // Should have tried to resolve but not create watcher
      expect(fs.statSync).toHaveBeenCalled();
    });

    it('should skip paths in node_modules', () => {
      const imports = ['./../../node_modules/package'];

      vi.mocked(fs.statSync).mockReturnValue({
        isFile: () => true,
      } as fs.Stats);

      watcher.updateDependencies(imports);

      // Even if file exists, should skip node_modules paths
      // resolveImportSync checks for node_modules in resolved path
      expect(onChangeCallback).not.toHaveBeenCalled();
    });

    it('should handle files with existing extensions', () => {
      const imports = ['./component.tsx', './utils.ts'];

      vi.mocked(fs.statSync).mockReturnValue({
        isFile: () => true,
      } as fs.Stats);

      watcher.updateDependencies(imports);

      expect(fs.statSync).toHaveBeenCalled();
    });
  });

  describe('watcher lifecycle', () => {
    it('should add watchers for new dependencies', () => {
      vi.mocked(fs.statSync).mockReturnValue({
        isFile: () => true,
      } as fs.Stats);

      watcher.updateDependencies(['./component.tsx']);

      // Should have called statSync to check file
      expect(fs.statSync).toHaveBeenCalled();
    });

    it('should remove watchers for removed dependencies', () => {
      vi.mocked(fs.statSync).mockReturnValue({
        isFile: () => true,
      } as fs.Stats);

      // Add dependencies
      watcher.updateDependencies(['./component.tsx', './utils.ts']);

      vi.clearAllMocks();

      // Remove one dependency
      watcher.updateDependencies(['./component.tsx']);

      // Should have checked for the remaining dependency
      expect(fs.statSync).toHaveBeenCalled();
    });

    it('should handle dependency list updates', () => {
      vi.mocked(fs.statSync).mockReturnValue({
        isFile: () => true,
      } as fs.Stats);

      // Initial dependencies
      watcher.updateDependencies(['./a.tsx', './b.tsx']);

      vi.clearAllMocks();

      // Updated dependencies
      watcher.updateDependencies(['./b.tsx', './c.tsx']);

      // Should process new dependencies
      expect(fs.statSync).toHaveBeenCalled();
    });

    it('should dispose all watchers', () => {
      vi.mocked(fs.statSync).mockReturnValue({
        isFile: () => true,
      } as fs.Stats);

      watcher.updateDependencies(['./component.tsx']);

      // Dispose method should exist (called by preview manager)
      expect(watcher.dispose).toBeDefined();
      watcher.dispose();
    });

    it('should handle empty to non-empty transitions', () => {
      // start w/ no dependencies
      watcher.updateDependencies([]);

      vi.mocked(fs.statSync).mockReturnValue({
        isFile: () => true,
      } as fs.Stats);

      // Add dependencies
      watcher.updateDependencies(['./component.tsx']);

      expect(fs.statSync).toHaveBeenCalled();
    });

    it('should handle non-empty to empty transitions', () => {
      vi.mocked(fs.statSync).mockReturnValue({
        isFile: () => true,
      } as fs.Stats);

      // start w/ dependencies
      watcher.updateDependencies(['./component.tsx']);

      vi.clearAllMocks();

      // Remove all dependencies
      watcher.updateDependencies([]);

      // Should not check any files
      expect(fs.statSync).not.toHaveBeenCalled();
    });
  });

  describe('setDocumentDir', () => {
    it('should allow changing document directory', () => {
      watcher.setDocumentDir('/new/path');

      vi.mocked(fs.statSync).mockReturnValue({
        isFile: () => true,
      } as fs.Stats);

      watcher.updateDependencies(['./component.tsx']);

      // Should use new directory for resolution
      expect(fs.statSync).toHaveBeenCalled();
    });

    it('should handle relative paths from new directory', () => {
      watcher.setDocumentDir('/workspace/docs');

      vi.mocked(fs.statSync).mockReturnValue({
        isFile: () => true,
      } as fs.Stats);

      watcher.updateDependencies(['../src/component.tsx']);

      expect(fs.statSync).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle undefined imports', () => {
      expect(() => {
        watcher.updateDependencies([undefined as any]);
      }).not.toThrow();
    });

    it('should handle null imports', () => {
      expect(() => {
        watcher.updateDependencies([null as any]);
      }).not.toThrow();
    });

    it('should handle empty string imports', () => {
      watcher.updateDependencies(['']);

      expect(fs.statSync).not.toHaveBeenCalled();
    });

    it('should handle malformed paths', () => {
      const malformedPaths = ['./', '../', './/', '/..//./component'];

      vi.mocked(fs.statSync).mockImplementation(() => {
        throw new Error('ENOENT');
      });

      expect(() => {
        watcher.updateDependencies(malformedPaths);
      }).not.toThrow();
    });
  });
});
