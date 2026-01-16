// packages/extension/test/PreviewInitializer.test.ts
// unit tests for PreviewInitializer

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __resetMocks } from './__mocks__/vscode';
import { WEBVIEW_HANDSHAKE_TIMEOUT_MS } from '../constants';
import type { ResolvedConfig } from '../preview/config';

// Use vi.hoisted to define mocks that are used in vi.mock factories
const {
  mockDocumentTracker,
  mockDependencyWatcher,
  mockCustomCssWatcher,
  mockConfigWatcher,
  mockTailwindConfigWatcher,
  mockWatcherManager,
  mockGetTailwindProcessor,
} = vi.hoisted(() => {
  const createMockWatcher = () => ({
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    dispose: vi.fn(),
    isActive: vi.fn().mockReturnValue(false),
    isReady: vi.fn().mockReturnValue(true),
    setNotifier: vi.fn(),
  });

  return {
    mockDocumentTracker: vi.fn(() => createMockWatcher()),
    mockDependencyWatcher: vi.fn(() => createMockWatcher()),
    mockCustomCssWatcher: vi.fn(() => createMockWatcher()),
    mockConfigWatcher: vi.fn(() => createMockWatcher()),
    mockTailwindConfigWatcher: vi.fn(() => createMockWatcher()),
    mockWatcherManager: vi.fn(() => ({
      register: vi.fn(),
      unregister: vi.fn(),
      get: vi.fn(),
      has: vi.fn(),
      startAll: vi.fn().mockResolvedValue(undefined),
      waitForGate: vi.fn().mockResolvedValue(undefined),
      setReadyGate: vi.fn(),
      dispose: vi.fn(),
    })),
    mockGetTailwindProcessor: vi.fn(() => ({
      invalidateVersionCache: vi.fn(),
    })),
  };
});

vi.mock('../preview/watchers', () => ({
  DocumentTracker: mockDocumentTracker,
  DependencyWatcher: mockDependencyWatcher,
  CustomCssWatcher: mockCustomCssWatcher,
  ConfigWatcher: mockConfigWatcher,
  TailwindConfigWatcher: mockTailwindConfigWatcher,
  WatcherManager: mockWatcherManager,
}));

vi.mock('../services', () => ({
  getTailwindProcessor: mockGetTailwindProcessor,
}));

vi.mock('../preview/config', () => ({
  resolveConfig: vi.fn(),
}));

import { PreviewInitializer } from '../preview/PreviewInitializer';

describe('PreviewInitializer', () => {
  let initializer: PreviewInitializer;

  beforeEach(() => {
    __resetMocks();
    vi.clearAllMocks();
    initializer = new PreviewInitializer();
  });

  describe('createHandshake()', () => {
    it('returns promise and resolve function', () => {
      const result = initializer.createHandshake();

      expect(result).toHaveProperty('promise');
      expect(result).toHaveProperty('resolve');
      expect(typeof result.resolve).toBe('function');
      expect(result.promise).toBeInstanceOf(Promise);
    });

    it('promise resolves when resolve() called', async () => {
      const result = initializer.createHandshake();

      // Resolve immediately
      result.resolve();

      // Should resolve without timeout
      await expect(result.promise).resolves.toBeUndefined();
    });

    it('promise rejects after timeout', async () => {
      vi.useFakeTimers();

      const result = initializer.createHandshake();

      // Advance time past the timeout
      vi.advanceTimersByTime(WEBVIEW_HANDSHAKE_TIMEOUT_MS + 100);

      await expect(result.promise).rejects.toThrow('Webview handshake timeout');

      vi.useRealTimers();
    });

    it('uses configured timeout duration', async () => {
      vi.useFakeTimers();

      const result = initializer.createHandshake();

      // Just before timeout - should not reject
      vi.advanceTimersByTime(WEBVIEW_HANDSHAKE_TIMEOUT_MS - 100);

      // Resolve before rejection
      result.resolve();

      await expect(result.promise).resolves.toBeUndefined();

      vi.useRealTimers();
    });
  });

  describe('createWatchers()', () => {
    const mockOnDependencyChange = vi.fn();

    it('creates DocumentTracker watcher', () => {
      const manager = initializer.createWatchers('', mockOnDependencyChange);

      expect(mockDocumentTracker).toHaveBeenCalled();
      expect(manager.register).toHaveBeenCalledWith(
        'document',
        expect.anything()
      );
    });

    it('creates DependencyWatcher watcher', () => {
      const manager = initializer.createWatchers('', mockOnDependencyChange);

      expect(mockDependencyWatcher).toHaveBeenCalled();
      expect(manager.register).toHaveBeenCalledWith(
        'dependency',
        expect.anything()
      );
    });

    it('creates CustomCssWatcher when cssPath provided', () => {
      const manager = initializer.createWatchers(
        '/path/to/custom.css',
        mockOnDependencyChange
      );

      expect(mockCustomCssWatcher).toHaveBeenCalled();
      expect(manager.register).toHaveBeenCalledWith(
        'customCss',
        expect.anything()
      );
    });

    it('does not create CustomCssWatcher without cssPath', () => {
      initializer.createWatchers('', mockOnDependencyChange);

      expect(mockCustomCssWatcher).not.toHaveBeenCalled();
    });

    it('does not start any watchers', () => {
      const manager = initializer.createWatchers(
        '/path/to/custom.css',
        mockOnDependencyChange
      );

      // startAll should not have been called during createWatchers
      expect(manager.startAll).not.toHaveBeenCalled();
    });

    it('sets ready gate when webviewReadyPromise provided', () => {
      const readyPromise = Promise.resolve();
      const manager = initializer.createWatchers(
        '',
        mockOnDependencyChange,
        readyPromise
      );

      expect(manager.setReadyGate).toHaveBeenCalledWith(readyPromise);
    });

    it('does not set ready gate when webviewReadyPromise not provided', () => {
      const manager = initializer.createWatchers('', mockOnDependencyChange);

      expect(manager.setReadyGate).not.toHaveBeenCalled();
    });
  });

  describe('startWatchers()', () => {
    it('starts all registered watchers', async () => {
      const manager = initializer.createWatchers('', vi.fn());

      await initializer.startWatchers(manager);

      expect(manager.startAll).toHaveBeenCalledOnce();
    });
  });

  describe('initializeWatchers() [backward compat]', () => {
    it('creates and starts watchers', () => {
      const manager = initializer.initializeWatchers('', vi.fn());

      // Should have called startAll (fire-and-forget)
      expect(manager.startAll).toHaveBeenCalled();
    });
  });

  describe('setupConfigWatcher()', () => {
    it('registers watcher for file scheme documents with valid config', () => {
      const manager = initializer.createWatchers('', vi.fn());
      const onConfigChange = vi.fn();
      const mdxPreviewConfig = {
        configPath: '/path/to/.mdx-previewrc.json',
        configDir: '/path/to',
        config: { plugins: [], components: {} },
      } as ResolvedConfig;

      initializer.setupConfigWatcher(
        manager,
        'file',
        mdxPreviewConfig,
        onConfigChange
      );

      expect(mockConfigWatcher).toHaveBeenCalledWith(
        '/path/to/.mdx-previewrc.json',
        expect.any(Function)
      );
      expect(manager.register).toHaveBeenCalledWith(
        'config',
        expect.anything()
      );
    });

    it('does not register for non-file scheme', () => {
      const manager = initializer.createWatchers('', vi.fn());
      const onConfigChange = vi.fn();
      const mdxPreviewConfig = {
        configPath: '/path/to/.mdx-previewrc.json',
        configDir: '/path/to',
        config: { plugins: [], components: {} },
      } as ResolvedConfig;

      // Clear mocks from createWatchers
      mockConfigWatcher.mockClear();

      initializer.setupConfigWatcher(
        manager,
        'untitled',
        mdxPreviewConfig,
        onConfigChange
      );

      // ConfigWatcher should not be created for non-file scheme
      expect(mockConfigWatcher).not.toHaveBeenCalled();
    });

    it('unregisters existing when config null', () => {
      const manager = initializer.createWatchers('', vi.fn());
      const onConfigChange = vi.fn();

      initializer.setupConfigWatcher(
        manager,
        'file',
        undefined,
        onConfigChange
      );

      expect(manager.unregister).toHaveBeenCalledWith('config');
    });

    it('always unregisters existing config watcher first', () => {
      const manager = initializer.createWatchers('', vi.fn());
      const onConfigChange = vi.fn();
      const mdxPreviewConfig = {
        configPath: '/path/to/.mdx-previewrc.json',
        configDir: '/path/to',
        config: { plugins: [], components: {} },
      } as ResolvedConfig;

      initializer.setupConfigWatcher(
        manager,
        'file',
        mdxPreviewConfig,
        onConfigChange
      );

      expect(manager.unregister).toHaveBeenCalledWith('config');
    });

    it('starts config watcher after registration', () => {
      const manager = initializer.createWatchers('', vi.fn());
      const onConfigChange = vi.fn();
      const mdxPreviewConfig = {
        configPath: '/path/to/.mdx-previewrc.json',
        configDir: '/path/to',
        config: { plugins: [], components: {} },
      } as ResolvedConfig;

      initializer.setupConfigWatcher(
        manager,
        'file',
        mdxPreviewConfig,
        onConfigChange
      );

      // The created watcher should have start called
      const createdWatcher =
        mockConfigWatcher.mock.results[
          mockConfigWatcher.mock.results.length - 1
        ]?.value;
      if (createdWatcher) {
        expect(createdWatcher.start).toHaveBeenCalled();
      }
    });
  });

  describe('setupCustomCssWatcher()', () => {
    it('registers and starts when cssPath provided', () => {
      const manager = initializer.createWatchers('', vi.fn());

      // Clear mocks from createWatchers
      mockCustomCssWatcher.mockClear();

      initializer.setupCustomCssWatcher(
        manager,
        '/path/to/styles.css',
        '/entry/directory'
      );

      expect(mockCustomCssWatcher).toHaveBeenCalled();
      expect(manager.register).toHaveBeenCalledWith(
        'customCss',
        expect.anything()
      );
    });

    it('unregisters when cssPath empty', () => {
      const manager = initializer.createWatchers('', vi.fn());

      initializer.setupCustomCssWatcher(manager, '', '/entry/directory');

      expect(manager.unregister).toHaveBeenCalledWith('customCss');
    });

    it('notifies webview via setNotifier if handle provided', () => {
      const manager = initializer.createWatchers('', vi.fn());
      const webviewHandle = { setCustomCss: vi.fn() };

      // Clear mocks from createWatchers
      mockCustomCssWatcher.mockClear();

      initializer.setupCustomCssWatcher(
        manager,
        '/path/to/styles.css',
        '/entry/directory',
        webviewHandle
      );

      // The created watcher should have setNotifier called
      const createdWatcher =
        mockCustomCssWatcher.mock.results[
          mockCustomCssWatcher.mock.results.length - 1
        ]?.value;
      if (createdWatcher) {
        expect(createdWatcher.setNotifier).toHaveBeenCalledWith(webviewHandle);
      }
    });

    it('starts watcher after registration', () => {
      const manager = initializer.createWatchers('', vi.fn());

      // Clear mocks from createWatchers
      mockCustomCssWatcher.mockClear();

      initializer.setupCustomCssWatcher(
        manager,
        '/path/to/styles.css',
        '/entry/directory'
      );

      const createdWatcher =
        mockCustomCssWatcher.mock.results[
          mockCustomCssWatcher.mock.results.length - 1
        ]?.value;
      if (createdWatcher) {
        expect(createdWatcher.start).toHaveBeenCalled();
      }
    });
  });

  describe('setupTailwindConfigWatcher()', () => {
    it('registers when watchFiles non-empty', () => {
      const manager = initializer.createWatchers('', vi.fn());
      const onChange = vi.fn();

      initializer.setupTailwindConfigWatcher(
        manager,
        ['/path/to/tailwind.config.js'],
        onChange
      );

      expect(mockTailwindConfigWatcher).toHaveBeenCalledWith(
        ['/path/to/tailwind.config.js'],
        expect.any(Function)
      );
      expect(manager.register).toHaveBeenCalledWith(
        'tailwind',
        expect.anything()
      );
    });

    it('unregisters when watchFiles empty', () => {
      const manager = initializer.createWatchers('', vi.fn());
      const onChange = vi.fn();

      initializer.setupTailwindConfigWatcher(manager, [], onChange);

      expect(manager.unregister).toHaveBeenCalledWith('tailwind');
    });

    it('always unregisters existing tailwind watcher first', () => {
      const manager = initializer.createWatchers('', vi.fn());
      const onChange = vi.fn();

      initializer.setupTailwindConfigWatcher(
        manager,
        ['/path/to/tailwind.config.js'],
        onChange
      );

      expect(manager.unregister).toHaveBeenCalledWith('tailwind');
    });

    it('starts watcher after registration', () => {
      const manager = initializer.createWatchers('', vi.fn());
      const onChange = vi.fn();

      initializer.setupTailwindConfigWatcher(
        manager,
        ['/path/to/tailwind.config.js'],
        onChange
      );

      const createdWatcher =
        mockTailwindConfigWatcher.mock.results[
          mockTailwindConfigWatcher.mock.results.length - 1
        ]?.value;
      if (createdWatcher) {
        expect(createdWatcher.start).toHaveBeenCalled();
      }
    });
  });

  describe('dependency watcher callback', () => {
    it('dependency callback waits for ready gate', async () => {
      let capturedCallback: ((fsPath: string) => Promise<void>) | null = null;

      // Capture the callback passed to DependencyWatcher
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockDependencyWatcher as any).mockImplementation(
        (callback: (fsPath: string) => Promise<void>) => {
          capturedCallback = callback;
          return {
            start: vi.fn().mockResolvedValue(undefined),
            stop: vi.fn(),
            dispose: vi.fn(),
            isActive: vi.fn().mockReturnValue(false),
            isReady: vi.fn().mockReturnValue(true),
            setNotifier: vi.fn(),
          };
        }
      );

      const onDependencyChange = vi.fn();
      const manager = initializer.createWatchers('', onDependencyChange);

      // Verify callback was captured
      expect(capturedCallback).not.toBeNull();

      // Call the callback - it should wait for gate
      if (capturedCallback) {
        await (capturedCallback as (fsPath: string) => Promise<void>)(
          '/some/file.ts'
        );
      }

      expect(manager.waitForGate).toHaveBeenCalled();
    });
  });
});
