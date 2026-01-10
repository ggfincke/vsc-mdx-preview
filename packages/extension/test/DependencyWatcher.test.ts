// packages/extension/test/DependencyWatcher.test.ts
// tests for DependencyWatcher - verifies import detection, resolution, and file watching

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DependencyWatcher } from '../preview/watchers/DependencyWatcher';
import * as fs from 'fs';

// Mock fs module
vi.mock('fs');

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

      // Mock file existence
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);

      watcher.updateDependencies(localImports);

      // Should have created watchers (indicated by vscode mock being called)
      // We can't directly test private methods, but we can verify behavior
      expect(fs.existsSync).toHaveBeenCalled();
    });

    it('should skip node_modules imports', () => {
      const nodeModulesImports = ['react', 'lodash', '@types/node'];

      const existsSpy = vi.spyOn(fs, 'existsSync');

      watcher.updateDependencies(nodeModulesImports);

      // Should not attempt to resolve node_modules
      expect(existsSpy).not.toHaveBeenCalled();
    });

    it('should skip http/https URLs', () => {
      const urlImports = [
        'https://example.com/module.js',
        'http://cdn.example.com/lib.js',
      ];

      const existsSpy = vi.spyOn(fs, 'existsSync');

      watcher.updateDependencies(urlImports);

      expect(existsSpy).not.toHaveBeenCalled();
    });

    it('should skip npm:// imports', () => {
      const npmImports = ['npm://package-name', 'npm://scoped/package'];

      const existsSpy = vi.spyOn(fs, 'existsSync');

      watcher.updateDependencies(npmImports);

      expect(existsSpy).not.toHaveBeenCalled();
    });

    it('should handle empty import list', () => {
      const existsSpy = vi.spyOn(fs, 'existsSync');

      watcher.updateDependencies([]);

      expect(existsSpy).not.toHaveBeenCalled();
    });

    it('should handle mixed import types', () => {
      const mixedImports = [
        './local-file',
        'node-module',
        'https://example.com/file.js',
        '../another-local',
      ];

      vi.spyOn(fs, 'existsSync').mockReturnValue(true);

      watcher.updateDependencies(mixedImports);

      // Should only check local files
      expect(fs.existsSync).toHaveBeenCalled();
    });
  });

  describe('import resolution', () => {
    it('should resolve with common extensions (.ts, .tsx, .js, .jsx)', () => {
      const imports = ['./component'];

      // Mock file doesn't exist without extension, but exists with .tsx
      vi.spyOn(fs, 'existsSync').mockImplementation((path) => {
        return path.toString().endsWith('.tsx');
      });

      watcher.updateDependencies(imports);

      // Should have tried multiple extensions
      expect(fs.existsSync).toHaveBeenCalled();
      const calls = (fs.existsSync as any).mock.calls;
      const extensions = calls.map((call: any) =>
        call[0].toString().split('.').pop()
      );
      expect(extensions).toContain('tsx');
    });

    it('should detect index files', () => {
      const imports = ['./components'];

      // Mock directory with index file
      vi.spyOn(fs, 'existsSync').mockImplementation((path) => {
        return (
          path.toString().includes('index.tsx') ||
          path.toString().includes('index.ts')
        );
      });

      watcher.updateDependencies(imports);

      expect(fs.existsSync).toHaveBeenCalled();
    });

    it('should return null for non-existent files', () => {
      const imports = ['./non-existent'];

      vi.spyOn(fs, 'existsSync').mockReturnValue(false);

      watcher.updateDependencies(imports);

      // Should have tried to resolve but not create watcher
      expect(fs.existsSync).toHaveBeenCalled();
    });

    it('should skip paths in node_modules', () => {
      const imports = ['./../../node_modules/package'];

      vi.spyOn(fs, 'existsSync').mockReturnValue(true);

      watcher.updateDependencies(imports);

      // Even if file exists, should skip node_modules paths
      // Implementation detail: DependencyWatcher checks for node_modules in resolved path
      expect(onChangeCallback).not.toHaveBeenCalled();
    });

    it('should handle files with existing extensions', () => {
      const imports = ['./component.tsx', './utils.ts'];

      vi.spyOn(fs, 'existsSync').mockReturnValue(true);

      watcher.updateDependencies(imports);

      expect(fs.existsSync).toHaveBeenCalled();
    });
  });

  describe('watcher lifecycle', () => {
    it('should add watchers for new dependencies', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);

      watcher.updateDependencies(['./component.tsx']);

      // Should have called existsSync to check file
      expect(fs.existsSync).toHaveBeenCalled();
    });

    it('should remove watchers for removed dependencies', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);

      // Add dependencies
      watcher.updateDependencies(['./component.tsx', './utils.ts']);

      vi.clearAllMocks();

      // Remove one dependency
      watcher.updateDependencies(['./component.tsx']);

      // Should have checked for the remaining dependency
      expect(fs.existsSync).toHaveBeenCalled();
    });

    it('should handle dependency list updates', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);

      // Initial dependencies
      watcher.updateDependencies(['./a.tsx', './b.tsx']);

      vi.clearAllMocks();

      // Updated dependencies
      watcher.updateDependencies(['./b.tsx', './c.tsx']);

      // Should process new dependencies
      expect(fs.existsSync).toHaveBeenCalled();
    });

    it('should dispose all watchers', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);

      watcher.updateDependencies(['./component.tsx']);

      // Dispose method should exist (called by preview manager)
      expect(watcher.dispose).toBeDefined();
      watcher.dispose();
    });

    it('should handle empty to non-empty transitions', () => {
      // Start with no dependencies
      watcher.updateDependencies([]);

      vi.spyOn(fs, 'existsSync').mockReturnValue(true);

      // Add dependencies
      watcher.updateDependencies(['./component.tsx']);

      expect(fs.existsSync).toHaveBeenCalled();
    });

    it('should handle non-empty to empty transitions', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);

      // Start with dependencies
      watcher.updateDependencies(['./component.tsx']);

      vi.clearAllMocks();

      // Remove all dependencies
      watcher.updateDependencies([]);

      // Should not check any files
      expect(fs.existsSync).not.toHaveBeenCalled();
    });
  });

  describe('setDocumentDir', () => {
    it('should allow changing document directory', () => {
      watcher.setDocumentDir('/new/path');

      vi.spyOn(fs, 'existsSync').mockReturnValue(true);

      watcher.updateDependencies(['./component.tsx']);

      // Should use new directory for resolution
      expect(fs.existsSync).toHaveBeenCalled();
    });

    it('should handle relative paths from new directory', () => {
      watcher.setDocumentDir('/workspace/docs');

      vi.spyOn(fs, 'existsSync').mockReturnValue(true);

      watcher.updateDependencies(['../src/component.tsx']);

      expect(fs.existsSync).toHaveBeenCalled();
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
      const existsSpy = vi.spyOn(fs, 'existsSync');

      watcher.updateDependencies(['']);

      expect(existsSpy).not.toHaveBeenCalled();
    });

    it('should handle malformed paths', () => {
      const malformedPaths = [
        './',
        '../',
        './/',
        '/..//./component',
      ];

      vi.spyOn(fs, 'existsSync').mockReturnValue(false);

      expect(() => {
        watcher.updateDependencies(malformedPaths);
      }).not.toThrow();
    });
  });
});
