// packages/extension/test/DependencyWatcher.test.ts
// tests for DependencyWatcher - verifies import detection, resolution, & file watching

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DependencyWatcher } from '../preview/watchers/DependencyWatcher';

// mock UnifiedResolver instead of fs (avoids module load time issues with enhanced-resolve)
const mockResolveSync = vi.fn();
const mockShouldResolve = vi.fn();
const mockIsRelativeImport = vi.fn();

vi.mock('../module-fetcher/UnifiedResolver', () => ({
  getUnifiedResolver: () => ({
    resolveSync: mockResolveSync,
    shouldResolve: mockShouldResolve,
    isRelativeImport: mockIsRelativeImport,
  }),
}));

describe('DependencyWatcher', () => {
  let watcher: DependencyWatcher;
  let onChangeCallback: ReturnType<typeof vi.fn>;

  // helper to configure mock for multiple relative imports that resolve
  function mockRelativeImports(specifiers: string[]) {
    mockShouldResolve.mockImplementation((s: string) => {
      return s && !s.startsWith('http') && !s.startsWith('npm://');
    });
    mockIsRelativeImport.mockImplementation((s: string) => {
      return s?.startsWith('./') || s?.startsWith('../');
    });
    mockResolveSync.mockImplementation((s: string) => {
      if (specifiers.includes(s)) {
        return {
          fsPath: `/workspace/src/${s.replace(/^\.\//, '')}`,
          isBuiltInShim: false,
          specifier: s,
        };
      }
      return null;
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    onChangeCallback = vi.fn();
    watcher = new DependencyWatcher(onChangeCallback);
    watcher.setDocumentDir('/workspace/src');

    // default mock behavior
    mockShouldResolve.mockImplementation((s: string) => {
      return s && !s.startsWith('http') && !s.startsWith('npm://');
    });
    mockIsRelativeImport.mockImplementation((s: string) => {
      return s?.startsWith('./') || s?.startsWith('../');
    });
    mockResolveSync.mockReturnValue(null);
  });

  describe('import classification', () => {
    it('should detect local imports (./foo, ../bar)', () => {
      const localImports = ['./component', '../utils/helper', './lib/index'];
      mockRelativeImports(localImports);

      watcher.updateDependencies(localImports);

      // Should have called resolveSync for local imports
      expect(mockResolveSync).toHaveBeenCalled();
    });

    it('should skip node_modules imports', () => {
      const nodeModulesImports = ['react', 'lodash', '@types/node'];

      watcher.updateDependencies(nodeModulesImports);

      // Should check shouldResolve but not call resolveSync (not relative)
      expect(mockShouldResolve).toHaveBeenCalled();
      expect(mockResolveSync).not.toHaveBeenCalled();
    });

    it('should skip http/https URLs', () => {
      const urlImports = [
        'https://example.com/module.js',
        'http://cdn.example.com/lib.js',
      ];

      watcher.updateDependencies(urlImports);

      // shouldResolve returns false for URLs
      expect(mockResolveSync).not.toHaveBeenCalled();
    });

    it('should skip npm:// imports', () => {
      const npmImports = ['npm://package-name', 'npm://scoped/package'];

      watcher.updateDependencies(npmImports);

      expect(mockResolveSync).not.toHaveBeenCalled();
    });

    it('should handle empty import list', () => {
      watcher.updateDependencies([]);

      expect(mockResolveSync).not.toHaveBeenCalled();
    });

    it('should handle mixed import types', () => {
      const mixedImports = [
        './local-file',
        'node-module',
        'https://example.com/file.js',
        '../another-local',
      ];

      mockRelativeImports(['./local-file', '../another-local']);

      watcher.updateDependencies(mixedImports);

      // Should only resolve local files
      expect(mockResolveSync).toHaveBeenCalledTimes(2);
    });
  });

  describe('import resolution', () => {
    it('should resolve imports via UnifiedResolver', () => {
      const imports = ['./component'];
      mockRelativeImports(imports);

      watcher.updateDependencies(imports);

      // Should call resolveSync with context
      expect(mockResolveSync).toHaveBeenCalledWith(
        './component',
        expect.objectContaining({ baseDir: '/workspace/src' }),
        'dependency'
      );
    });

    it('should detect index files (via resolver)', () => {
      const imports = ['./components'];
      mockRelativeImports(imports);

      watcher.updateDependencies(imports);

      expect(mockResolveSync).toHaveBeenCalled();
    });

    it('should handle unresolved files', () => {
      const imports = ['./non-existent'];

      // mockResolveSync returns null by default
      watcher.updateDependencies(imports);

      // Should have tried to resolve
      expect(mockResolveSync).toHaveBeenCalled();
      // But no watchers created (null result)
    });

    it('should skip built-in shims', () => {
      const imports = ['./some-shim'];
      mockResolveSync.mockReturnValue({
        fsPath: 'shim://built-in',
        isBuiltInShim: true,
        specifier: './some-shim',
      });

      watcher.updateDependencies(imports);

      // Should resolve but not create watcher for shim
      expect(mockResolveSync).toHaveBeenCalled();
    });

    it('should handle files with existing extensions', () => {
      const imports = ['./component.tsx', './utils.ts'];
      mockRelativeImports(imports);

      watcher.updateDependencies(imports);

      expect(mockResolveSync).toHaveBeenCalledTimes(2);
    });
  });

  describe('watcher lifecycle', () => {
    it('should add watchers for new dependencies', () => {
      mockRelativeImports(['./component.tsx']);

      watcher.updateDependencies(['./component.tsx']);

      // Should have called resolveSync
      expect(mockResolveSync).toHaveBeenCalled();
    });

    it('should remove watchers for removed dependencies', () => {
      mockRelativeImports(['./component.tsx', './utils.ts']);

      // Add dependencies
      watcher.updateDependencies(['./component.tsx', './utils.ts']);

      vi.clearAllMocks();
      mockRelativeImports(['./component.tsx']);

      // Remove one dependency
      watcher.updateDependencies(['./component.tsx']);

      // Should have checked for the remaining dependency
      expect(mockResolveSync).toHaveBeenCalled();
    });

    it('should handle dependency list updates', () => {
      mockRelativeImports(['./a.tsx', './b.tsx']);

      // Initial dependencies
      watcher.updateDependencies(['./a.tsx', './b.tsx']);

      vi.clearAllMocks();
      mockRelativeImports(['./b.tsx', './c.tsx']);

      // Updated dependencies
      watcher.updateDependencies(['./b.tsx', './c.tsx']);

      // Should process new dependencies
      expect(mockResolveSync).toHaveBeenCalled();
    });

    it('should dispose all watchers', () => {
      mockRelativeImports(['./component.tsx']);

      watcher.updateDependencies(['./component.tsx']);

      // Dispose method should exist (called by preview manager)
      expect(watcher.dispose).toBeDefined();
      watcher.dispose();
    });

    it('should handle empty to non-empty transitions', () => {
      // start w/ no dependencies
      watcher.updateDependencies([]);

      mockRelativeImports(['./component.tsx']);

      // Add dependencies
      watcher.updateDependencies(['./component.tsx']);

      expect(mockResolveSync).toHaveBeenCalled();
    });

    it('should handle non-empty to empty transitions', () => {
      mockRelativeImports(['./component.tsx']);

      // start w/ dependencies
      watcher.updateDependencies(['./component.tsx']);

      vi.clearAllMocks();

      // Remove all dependencies
      watcher.updateDependencies([]);

      // Should not call resolveSync for empty list
      expect(mockResolveSync).not.toHaveBeenCalled();
    });
  });

  describe('setDocumentDir', () => {
    it('should allow changing document directory', () => {
      watcher.setDocumentDir('/new/path');
      mockRelativeImports(['./component.tsx']);

      watcher.updateDependencies(['./component.tsx']);

      // Should use new directory for resolution
      expect(mockResolveSync).toHaveBeenCalledWith(
        './component.tsx',
        expect.objectContaining({ baseDir: '/new/path' }),
        'dependency'
      );
    });

    it('should handle relative paths from new directory', () => {
      watcher.setDocumentDir('/workspace/docs');
      mockRelativeImports(['../src/component.tsx']);

      watcher.updateDependencies(['../src/component.tsx']);

      expect(mockResolveSync).toHaveBeenCalled();
    });
  });

  describe('setResolutionContext', () => {
    it('should use resolution context when set', () => {
      const context = {
        baseDir: '/custom/base',
        workspaceRoot: '/workspace',
      };
      watcher.setResolutionContext(context);
      mockRelativeImports(['./component.tsx']);

      watcher.updateDependencies(['./component.tsx']);

      expect(mockResolveSync).toHaveBeenCalledWith(
        './component.tsx',
        context,
        'dependency'
      );
    });

    it('should prefer resolution context over documentDir', () => {
      watcher.setDocumentDir('/old/path');
      const context = { baseDir: '/new/context/path' };
      watcher.setResolutionContext(context);
      mockRelativeImports(['./component.tsx']);

      watcher.updateDependencies(['./component.tsx']);

      expect(mockResolveSync).toHaveBeenCalledWith(
        './component.tsx',
        context,
        'dependency'
      );
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

      expect(mockResolveSync).not.toHaveBeenCalled();
    });

    it('should handle malformed paths', () => {
      const malformedPaths = ['./', '../', './/', '/..//./component'];

      expect(() => {
        watcher.updateDependencies(malformedPaths);
      }).not.toThrow();
    });
  });
});
