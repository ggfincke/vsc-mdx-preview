// packages/extension/test/CustomCssWatcher.test.ts
// tests for CustomCssWatcher - watches custom CSS file for changes

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// mock fs.promises before importing CustomCssWatcher
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
  },
}));

import { CustomCssWatcher } from '../preview/watchers/CustomCssWatcher';
import * as fs from 'fs';

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

import * as vscode from 'vscode';

describe('CustomCssWatcher', () => {
  let watcher: CustomCssWatcher;
  let mockWatcher: {
    onDidChange: ReturnType<typeof vi.fn>;
    onDidCreate: ReturnType<typeof vi.fn>;
    onDidDelete: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  };
  let changeHandler: () => void;
  let createHandler: () => void;
  let deleteHandler: () => void;

  beforeEach(() => {
    mockWatcher = {
      onDidChange: vi.fn((handler) => {
        changeHandler = handler;
        return { dispose: vi.fn() };
      }),
      onDidCreate: vi.fn((handler) => {
        createHandler = handler;
        return { dispose: vi.fn() };
      }),
      onDidDelete: vi.fn((handler) => {
        deleteHandler = handler;
        return { dispose: vi.fn() };
      }),
      dispose: vi.fn(),
    };

    vi.mocked(vscode.workspace.createFileSystemWatcher).mockReturnValue(
      mockWatcher as any
    );
    vi.mocked(fs.promises.readFile).mockResolvedValue('.test { color: red; }');
  });

  afterEach(() => {
    watcher?.dispose();
    vi.clearAllMocks();
  });

  describe('path resolution', () => {
    it('uses absolute path as-is', async () => {
      const absolutePath = '/absolute/path/styles.css';
      watcher = new CustomCssWatcher(absolutePath, undefined, null);

      await watcher.start();

      expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledWith(
        absolutePath
      );
    });

    it('resolves relative path from workspace folder', async () => {
      const workspaceFolders = [{ uri: { fsPath: '/workspace' } }] as any;
      watcher = new CustomCssWatcher('styles.css', workspaceFolders, null);

      await watcher.start();

      expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledWith(
        '/workspace/styles.css'
      );
    });

    it('resolves relative path from document directory as fallback', async () => {
      watcher = new CustomCssWatcher('styles.css', undefined, '/doc/dir');

      await watcher.start();

      expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledWith(
        '/doc/dir/styles.css'
      );
    });

    it('cannot start with unresolvable relative path', async () => {
      watcher = new CustomCssWatcher('styles.css', undefined, null);

      await watcher.start();

      expect(watcher.isActive()).toBe(false);
    });
  });

  describe('canStart', () => {
    it('returns false when cssPath is empty', async () => {
      watcher = new CustomCssWatcher('', undefined, null);

      await watcher.start();

      expect(watcher.isActive()).toBe(false);
    });

    it('returns true when path can be resolved', async () => {
      watcher = new CustomCssWatcher('/path/styles.css', undefined, null);

      await watcher.start();

      expect(watcher.isActive()).toBe(true);
    });
  });

  describe('start', () => {
    it('loads and sends initial CSS', async () => {
      const notifier = { setCustomCss: vi.fn() };
      watcher = new CustomCssWatcher('/path/styles.css', undefined, null);
      watcher.setNotifier(notifier);

      await watcher.start();

      expect(fs.promises.readFile).toHaveBeenCalledWith(
        '/path/styles.css',
        'utf-8'
      );
      expect(notifier.setCustomCss).toHaveBeenCalledWith(
        '.test { color: red; }'
      );
    });

    it('creates file system watcher', async () => {
      watcher = new CustomCssWatcher('/path/styles.css', undefined, null);

      await watcher.start();

      expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledWith(
        '/path/styles.css'
      );
    });

    it('sets up change handlers', async () => {
      watcher = new CustomCssWatcher('/path/styles.css', undefined, null);

      await watcher.start();

      expect(mockWatcher.onDidChange).toHaveBeenCalled();
      expect(mockWatcher.onDidCreate).toHaveBeenCalled();
      expect(mockWatcher.onDidDelete).toHaveBeenCalled();
    });
  });

  describe('setNotifier', () => {
    it('sends CSS immediately if already loaded', async () => {
      const notifier = { setCustomCss: vi.fn() };
      watcher = new CustomCssWatcher('/path/styles.css', undefined, null);

      await watcher.start();
      watcher.setNotifier(notifier);

      // Wait for async loadAndSendCss to complete
      await vi.waitFor(() => {
        expect(notifier.setCustomCss).toHaveBeenCalled();
      });
    });
  });

  describe('file change handling', () => {
    it('reloads CSS on file change', async () => {
      const notifier = { setCustomCss: vi.fn() };
      watcher = new CustomCssWatcher('/path/styles.css', undefined, null);
      watcher.setNotifier(notifier);

      await watcher.start();
      notifier.setCustomCss.mockClear();

      vi.mocked(fs.promises.readFile).mockResolvedValue(
        '.updated { color: blue; }'
      );
      changeHandler();

      // Wait for async readFile
      await vi.waitFor(() => {
        expect(notifier.setCustomCss).toHaveBeenCalledWith(
          '.updated { color: blue; }'
        );
      });
    });

    it('reloads CSS on file create', async () => {
      const notifier = { setCustomCss: vi.fn() };
      watcher = new CustomCssWatcher('/path/styles.css', undefined, null);
      watcher.setNotifier(notifier);

      await watcher.start();
      notifier.setCustomCss.mockClear();

      createHandler();

      await vi.waitFor(() => {
        expect(notifier.setCustomCss).toHaveBeenCalled();
      });
    });

    it('sends empty CSS on file delete', async () => {
      const notifier = { setCustomCss: vi.fn() };
      watcher = new CustomCssWatcher('/path/styles.css', undefined, null);
      watcher.setNotifier(notifier);

      await watcher.start();
      notifier.setCustomCss.mockClear();

      deleteHandler();

      expect(notifier.setCustomCss).toHaveBeenCalledWith('');
    });
  });

  describe('error handling', () => {
    it('handles file read errors gracefully', async () => {
      vi.mocked(fs.promises.readFile).mockRejectedValue(
        new Error('File not found')
      );
      watcher = new CustomCssWatcher('/path/styles.css', undefined, null);

      // Should not throw
      await expect(watcher.start()).resolves.not.toThrow();
    });
  });

  describe('stop', () => {
    it('disposes watchers', async () => {
      watcher = new CustomCssWatcher('/path/styles.css', undefined, null);

      await watcher.start();
      watcher.stop();

      expect(mockWatcher.dispose).toHaveBeenCalled();
    });

    it('clears resolved path', async () => {
      watcher = new CustomCssWatcher('/path/styles.css', undefined, null);

      await watcher.start();
      watcher.stop();

      expect(watcher.isReady()).toBe(false);
    });
  });

  describe('updatePath', () => {
    it('disposes and restarts with new path', async () => {
      watcher = new CustomCssWatcher('/old/styles.css', undefined, null);

      await watcher.start();
      const oldWatcherMock = mockWatcher;
      watcher.updatePath('/new/styles.css', undefined, null);

      expect(oldWatcherMock.dispose).toHaveBeenCalled();
      // Wait for async onStart to complete with new watcher
      await vi.waitFor(() => {
        expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledTimes(
          2
        );
      });
      expect(vscode.workspace.createFileSystemWatcher).toHaveBeenNthCalledWith(
        2,
        '/new/styles.css'
      );
    });
  });

  describe('watch (alias)', () => {
    it('calls start', async () => {
      watcher = new CustomCssWatcher('/path/styles.css', undefined, null);

      watcher.watch();

      // Give async start time to complete
      await vi.waitFor(() => {
        expect(watcher.isActive()).toBe(true);
      });
    });
  });
});
