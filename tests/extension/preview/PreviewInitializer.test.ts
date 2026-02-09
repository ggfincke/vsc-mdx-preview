// tests/extension/preview/PreviewInitializer.test.ts
// unit tests for preview initialization & watcher orchestration

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PreviewInitializer } from '../../../packages/extension-host/src/features/preview/PreviewInitializer';
import { WatcherManager } from '../../../packages/extension-host/src/features/preview/watchers/WatcherManager';
import { WEBVIEW_HANDSHAKE_TIMEOUT_MS } from '../../../packages/extension-host/src/shared/constants';
import type { ResolvedConfig } from '../../../packages/extension-host/src/types';

const { configHandlers, mockTailwindProcessor, mockConfigManager } = vi.hoisted(() => ({
  configHandlers: [] as Array<(event: { configPath: string }) => void>,
  mockTailwindProcessor: {
    invalidateVersionCache: vi.fn(),
    invalidateDetectionCaches: vi.fn(),
    invalidateScanCache: vi.fn(),
  },
  mockConfigManager: {
    get: vi.fn(() => 200),
  },
}));

vi.mock('../../../packages/extension-host/src/features/preview/configuration', () => ({
  onConfigChange: (handler: (event: { configPath: string }) => void) => {
    configHandlers.push(handler);
    return { dispose: vi.fn() };
  },
}));

vi.mock('../../../packages/extension-host/src/shared/logging/logger', () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  createTaggedLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('../../../packages/extension-host/src/app/services', () => ({
  getTailwindProcessor: () => mockTailwindProcessor,
  getConfigManager: () => mockConfigManager,
  getConfigCache: () => ({
    subscribe: vi.fn(() => ({ dispose: vi.fn() })),
  }),
}));

describe('PreviewInitializer', () => {
  beforeEach(() => {
    configHandlers.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves handshake when resolve is called', async () => {
    const initializer = new PreviewInitializer();
    const { promise, resolve } = initializer.createHandshake();

    resolve();

    await expect(promise).resolves.toBeUndefined();
  });

  it('rejects handshake after timeout', async () => {
    vi.useFakeTimers();
    const initializer = new PreviewInitializer();
    const { promise } = initializer.createHandshake();

    vi.advanceTimersByTime(WEBVIEW_HANDSHAKE_TIMEOUT_MS + 1);

    await expect(promise).rejects.toThrow(/handshake timeout/i);
  });

  it('registers core watchers in createWatchers', () => {
    const initializer = new PreviewInitializer();
    const watcherManager = initializer.createWatchers(
      '/workspace/custom.css',
      vi.fn(async () => undefined),
      Promise.resolve(),
      vi.fn()
    );

    const names = watcherManager.getNames();
    expect(names).toEqual(
      expect.arrayContaining(['document', 'dependency', 'customCss', 'packageJson'])
    );
  });

  it('sets up config watcher when config is available', () => {
    const initializer = new PreviewInitializer();
    const watcherManager = new WatcherManager();
    const onConfigChanged = vi.fn();

    const config: ResolvedConfig = {
      configPath: '/workspace/.mdx-previewrc.json',
      configDir: '/workspace',
      config: {},
    };

    initializer.setupConfigWatcher(
      watcherManager,
      'file',
      config,
      onConfigChanged
    );

    expect(watcherManager.has('config')).toBe(true);
    expect(configHandlers.length).toBe(1);

    configHandlers[0]({ configPath: '/workspace/other.json' });
    expect(onConfigChanged).not.toHaveBeenCalled();

    configHandlers[0]({ configPath: config.configPath });
    expect(onConfigChanged).toHaveBeenCalledTimes(1);
  });

  it('skips config watcher for non-file documents', () => {
    const initializer = new PreviewInitializer();
    const watcherManager = new WatcherManager();
    const onConfigChanged = vi.fn();

    initializer.setupConfigWatcher(
      watcherManager,
      'untitled',
      undefined,
      onConfigChanged
    );

    expect(watcherManager.has('config')).toBe(false);
  });
});
