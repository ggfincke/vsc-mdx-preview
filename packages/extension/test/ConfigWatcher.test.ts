// packages/extension/test/ConfigWatcher.test.ts
// tests for ConfigWatcher - watches .mdx-previewrc.json for changes

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// mock onConfigChange before importing ConfigWatcher
vi.mock('../preview/config', () => ({
  onConfigChange: vi.fn(),
}));

import { ConfigWatcher } from '../preview/watchers/ConfigWatcher';
import { onConfigChange } from '../preview/config';

describe('ConfigWatcher', () => {
  let watcher: ConfigWatcher;
  let mockCallback: ReturnType<typeof vi.fn>;
  let mockDisposable: { dispose: ReturnType<typeof vi.fn> };
  let capturedConfigListener: ((path: string) => void) | null;

  beforeEach(() => {
    mockCallback = vi.fn();
    mockDisposable = { dispose: vi.fn() };
    capturedConfigListener = null;

    // Capture the listener passed to onConfigChange
    vi.mocked(onConfigChange).mockImplementation((listener) => {
      capturedConfigListener = listener;
      return mockDisposable;
    });
  });

  afterEach(() => {
    watcher?.dispose();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('creates watcher with config path and callback', () => {
      watcher = new ConfigWatcher('/path/to/.mdx-previewrc.json', mockCallback);

      expect(watcher.isActive()).toBe(false);
    });
  });

  describe('canStart', () => {
    it('returns false when configPath is empty', async () => {
      watcher = new ConfigWatcher('', mockCallback);

      await watcher.start();

      expect(watcher.isActive()).toBe(false);
    });

    it('returns true when configPath is set', async () => {
      watcher = new ConfigWatcher('/path/to/.mdx-previewrc.json', mockCallback);

      await watcher.start();

      expect(watcher.isActive()).toBe(true);
    });
  });

  describe('start', () => {
    it('registers config change listener', async () => {
      watcher = new ConfigWatcher('/path/to/.mdx-previewrc.json', mockCallback);

      await watcher.start();

      expect(onConfigChange).toHaveBeenCalled();
    });

    it('sets isActive to true', async () => {
      watcher = new ConfigWatcher('/path/to/.mdx-previewrc.json', mockCallback);

      await watcher.start();

      expect(watcher.isActive()).toBe(true);
    });
  });

  describe('config change handling', () => {
    it('calls callback when watched config file changes', async () => {
      const configPath = '/workspace/.mdx-previewrc.json';
      watcher = new ConfigWatcher(configPath, mockCallback);

      await watcher.start();
      capturedConfigListener!(configPath);

      expect(mockCallback).toHaveBeenCalled();
    });

    it('ignores changes to other config files', async () => {
      const configPath = '/workspace/.mdx-previewrc.json';
      watcher = new ConfigWatcher(configPath, mockCallback);

      await watcher.start();
      capturedConfigListener!('/other/path/.mdx-previewrc.json');

      expect(mockCallback).not.toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('disposes config change listener', async () => {
      watcher = new ConfigWatcher('/path/to/.mdx-previewrc.json', mockCallback);

      await watcher.start();
      watcher.stop();

      expect(mockDisposable.dispose).toHaveBeenCalled();
    });

    it('sets isActive to false', async () => {
      watcher = new ConfigWatcher('/path/to/.mdx-previewrc.json', mockCallback);

      await watcher.start();
      watcher.stop();

      expect(watcher.isActive()).toBe(false);
    });
  });

  describe('setConfigPath', () => {
    it('updates config path', async () => {
      watcher = new ConfigWatcher(
        '/old/path/.mdx-previewrc.json',
        mockCallback
      );
      await watcher.start();

      watcher.setConfigPath('/new/path/.mdx-previewrc.json');

      // Verify new path is used
      capturedConfigListener!('/new/path/.mdx-previewrc.json');
      expect(mockCallback).toHaveBeenCalled();
    });

    it('restarts watcher if was active', async () => {
      watcher = new ConfigWatcher(
        '/old/path/.mdx-previewrc.json',
        mockCallback
      );
      await watcher.start();

      watcher.setConfigPath('/new/path/.mdx-previewrc.json');

      expect(watcher.isActive()).toBe(true);
      expect(mockDisposable.dispose).toHaveBeenCalled();
    });

    it('does not start if was not active', () => {
      watcher = new ConfigWatcher(
        '/old/path/.mdx-previewrc.json',
        mockCallback
      );

      watcher.setConfigPath('/new/path/.mdx-previewrc.json');

      expect(watcher.isActive()).toBe(false);
    });
  });

  describe('dispose', () => {
    it('stops watching and cleans up', async () => {
      watcher = new ConfigWatcher('/path/to/.mdx-previewrc.json', mockCallback);

      await watcher.start();
      watcher.dispose();

      expect(mockDisposable.dispose).toHaveBeenCalled();
      expect(watcher.isActive()).toBe(false);
    });
  });
});
