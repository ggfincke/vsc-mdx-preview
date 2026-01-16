// packages/extension/test/TailwindConfigWatcher.test.ts
// tests for TailwindConfigWatcher - watches Tailwind config & entry CSS files

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// mock debounce to make it synchronous for testing
vi.mock('lodash.debounce', () => ({
  default: vi.fn((fn: () => void) => {
    const debouncedFn = vi.fn(fn);
    (debouncedFn as any).cancel = vi.fn();
    return debouncedFn;
  }),
}));

// mock vscode module
vi.mock('vscode', () => ({
  workspace: {
    createFileSystemWatcher: vi.fn(),
  },
  window: {
    createOutputChannel: vi.fn(() => ({
      appendLine: vi.fn(),
      show: vi.fn(),
      dispose: vi.fn(),
    })),
  },
}));

import { TailwindConfigWatcher } from '../preview/watchers/TailwindConfigWatcher';
import * as vscode from 'vscode';
import debounce from 'lodash.debounce';

describe('TailwindConfigWatcher', () => {
  let watcher: TailwindConfigWatcher;
  let onChange: ReturnType<typeof vi.fn>;
  let mockWatchers: Array<{
    onDidChange: ReturnType<typeof vi.fn>;
    onDidCreate: ReturnType<typeof vi.fn>;
    onDidDelete: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  }>;
  let changeHandlers: Map<string, () => void>;
  let createHandlers: Map<string, () => void>;
  let deleteHandlers: Map<string, () => void>;

  beforeEach(() => {
    onChange = vi.fn();
    mockWatchers = [];
    changeHandlers = new Map();
    createHandlers = new Map();
    deleteHandlers = new Map();

    vi.mocked(vscode.workspace.createFileSystemWatcher).mockImplementation(
      (pattern: string) => {
        const mockWatcher = {
          onDidChange: vi.fn((handler) => {
            changeHandlers.set(pattern as string, handler);
            return { dispose: vi.fn() };
          }),
          onDidCreate: vi.fn((handler) => {
            createHandlers.set(pattern as string, handler);
            return { dispose: vi.fn() };
          }),
          onDidDelete: vi.fn((handler) => {
            deleteHandlers.set(pattern as string, handler);
            return { dispose: vi.fn() };
          }),
          dispose: vi.fn(),
        };
        mockWatchers.push(mockWatcher);
        return mockWatcher as any;
      }
    );
  });

  afterEach(() => {
    watcher?.dispose();
    vi.clearAllMocks();
  });

  describe('canStart', () => {
    it('returns false when watchFiles is empty', () => {
      watcher = new TailwindConfigWatcher([], onChange);

      watcher.start();

      expect(watcher.isActive()).toBe(false);
    });

    it('returns true when watchFiles has entries', () => {
      watcher = new TailwindConfigWatcher(
        ['/path/tailwind.config.js'],
        onChange
      );

      watcher.start();

      expect(watcher.isActive()).toBe(true);
    });
  });

  describe('start', () => {
    it('creates watchers for all files', () => {
      const files = ['/path/tailwind.config.js', '/path/input.css'];
      watcher = new TailwindConfigWatcher(files, onChange);

      watcher.start();

      expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledTimes(2);
      expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledWith(
        '/path/tailwind.config.js'
      );
      expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledWith(
        '/path/input.css'
      );
    });

    it('sets up change handlers for each file', () => {
      const files = ['/path/tailwind.config.js', '/path/input.css'];
      watcher = new TailwindConfigWatcher(files, onChange);

      watcher.start();

      expect(mockWatchers[0].onDidChange).toHaveBeenCalled();
      expect(mockWatchers[0].onDidCreate).toHaveBeenCalled();
      expect(mockWatchers[0].onDidDelete).toHaveBeenCalled();
      expect(mockWatchers[1].onDidChange).toHaveBeenCalled();
      expect(mockWatchers[1].onDidCreate).toHaveBeenCalled();
      expect(mockWatchers[1].onDidDelete).toHaveBeenCalled();
    });
  });

  describe('file change handling', () => {
    it('calls debounced onChange on file change', () => {
      watcher = new TailwindConfigWatcher(
        ['/path/tailwind.config.js'],
        onChange
      );
      watcher.start();

      const handler = changeHandlers.get('/path/tailwind.config.js');
      handler?.();

      expect(onChange).toHaveBeenCalled();
    });

    it('calls debounced onChange on file create', () => {
      watcher = new TailwindConfigWatcher(
        ['/path/tailwind.config.js'],
        onChange
      );
      watcher.start();

      const handler = createHandlers.get('/path/tailwind.config.js');
      handler?.();

      expect(onChange).toHaveBeenCalled();
    });

    it('calls debounced onChange on file delete', () => {
      watcher = new TailwindConfigWatcher(
        ['/path/tailwind.config.js'],
        onChange
      );
      watcher.start();

      const handler = deleteHandlers.get('/path/tailwind.config.js');
      handler?.();

      expect(onChange).toHaveBeenCalled();
    });

    it('handles multiple file changes', () => {
      const files = ['/path/tailwind.config.js', '/path/input.css'];
      watcher = new TailwindConfigWatcher(files, onChange);
      watcher.start();

      changeHandlers.get('/path/tailwind.config.js')?.();
      changeHandlers.get('/path/input.css')?.();

      expect(onChange).toHaveBeenCalledTimes(2);
    });
  });

  describe('setWatchFiles', () => {
    it('updates watch files when not active', () => {
      watcher = new TailwindConfigWatcher([], onChange);

      watcher.setWatchFiles(['/new/tailwind.config.js']);
      watcher.start();

      expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledWith(
        '/new/tailwind.config.js'
      );
    });

    it('restarts watching when active', () => {
      watcher = new TailwindConfigWatcher(
        ['/old/tailwind.config.js'],
        onChange
      );
      watcher.start();

      expect(watcher.isActive()).toBe(true);
      vi.mocked(vscode.workspace.createFileSystemWatcher).mockClear();

      watcher.setWatchFiles(['/new/tailwind.config.js']);

      expect(watcher.isActive()).toBe(true);
      expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledWith(
        '/new/tailwind.config.js'
      );
    });

    it('disposes old watchers when restarting', () => {
      watcher = new TailwindConfigWatcher(
        ['/old/tailwind.config.js'],
        onChange
      );
      watcher.start();
      const oldWatcher = mockWatchers[0];

      watcher.setWatchFiles(['/new/tailwind.config.js']);

      expect(oldWatcher.dispose).toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('disposes all watchers', () => {
      const files = ['/path/tailwind.config.js', '/path/input.css'];
      watcher = new TailwindConfigWatcher(files, onChange);
      watcher.start();

      watcher.stop();

      expect(mockWatchers[0].dispose).toHaveBeenCalled();
      expect(mockWatchers[1].dispose).toHaveBeenCalled();
    });

    it('cancels debounced onChange', () => {
      watcher = new TailwindConfigWatcher(
        ['/path/tailwind.config.js'],
        onChange
      );
      watcher.start();

      // Get the debounced function created during construction
      const debouncedFn = vi.mocked(debounce).mock.results[0].value;

      watcher.stop();

      expect(debouncedFn.cancel).toHaveBeenCalled();
    });

    it('clears active state', () => {
      watcher = new TailwindConfigWatcher(
        ['/path/tailwind.config.js'],
        onChange
      );
      watcher.start();

      expect(watcher.isActive()).toBe(true);

      watcher.stop();

      expect(watcher.isActive()).toBe(false);
    });
  });

  describe('debounce behavior', () => {
    it('creates debounced onChange in constructor', () => {
      watcher = new TailwindConfigWatcher(
        ['/path/tailwind.config.js'],
        onChange
      );

      expect(debounce).toHaveBeenCalledWith(onChange, expect.any(Number));
    });
  });

  describe('error handling', () => {
    it('catches errors in change callback', () => {
      // Setup onChange to throw
      const errorOnChange = vi.fn().mockImplementation(() => {
        throw new Error('Test error');
      });

      // Re-mock debounce to use the error-throwing function
      vi.mocked(debounce).mockImplementation((fn: () => void) => {
        const debouncedFn = vi.fn(fn);
        (debouncedFn as any).cancel = vi.fn();
        return debouncedFn;
      });

      watcher = new TailwindConfigWatcher(
        ['/path/tailwind.config.js'],
        errorOnChange
      );
      watcher.start();

      // Should not throw
      expect(() => {
        changeHandlers.get('/path/tailwind.config.js')?.();
      }).not.toThrow();
    });

    it('catches errors in create callback', () => {
      const errorOnChange = vi.fn().mockImplementation(() => {
        throw new Error('Test error');
      });

      vi.mocked(debounce).mockImplementation((fn: () => void) => {
        const debouncedFn = vi.fn(fn);
        (debouncedFn as any).cancel = vi.fn();
        return debouncedFn;
      });

      watcher = new TailwindConfigWatcher(
        ['/path/tailwind.config.js'],
        errorOnChange
      );
      watcher.start();

      expect(() => {
        createHandlers.get('/path/tailwind.config.js')?.();
      }).not.toThrow();
    });

    it('catches errors in delete callback', () => {
      const errorOnChange = vi.fn().mockImplementation(() => {
        throw new Error('Test error');
      });

      vi.mocked(debounce).mockImplementation((fn: () => void) => {
        const debouncedFn = vi.fn(fn);
        (debouncedFn as any).cancel = vi.fn();
        return debouncedFn;
      });

      watcher = new TailwindConfigWatcher(
        ['/path/tailwind.config.js'],
        errorOnChange
      );
      watcher.start();

      expect(() => {
        deleteHandlers.get('/path/tailwind.config.js')?.();
      }).not.toThrow();
    });
  });
});
