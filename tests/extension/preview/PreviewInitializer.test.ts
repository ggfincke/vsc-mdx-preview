// tests/extension/preview/PreviewInitializer.test.ts
// unit tests for preview initialization & watcher orchestration

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PreviewInitializer } from '../../../packages/extension-host/src/features/preview/PreviewInitializer';
import { WatcherManager } from '../../../packages/extension-host/src/features/preview/watchers/WatcherManager';
import { WEBVIEW_HANDSHAKE_TIMEOUT_MS } from '../../../packages/extension-host/src/shared/constants';
import type { ResolvedConfig } from '../../../packages/extension-host/src/types';
import { mockTailwindProcessor, mockConfigManager, mockConfigCache } from '../../helpers/mock-services';

const { configHandlers } = vi.hoisted(() => ({
  configHandlers: [] as Array<(event: { configPath: string }) => void>,
}));

vi.mock(
  '../../../packages/extension-host/src/features/preview/configuration',
  () => ({
    onConfigChange: (handler: (event: { configPath: string }) => void) => {
      configHandlers.push(handler);
      return { dispose: vi.fn() };
    },
  })
);

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
      Promise.resolve()
    );

    const names = watcherManager.getNames();
    expect(names).toEqual(
      expect.arrayContaining([
        'document',
        'dependency',
        'customCss',
      ])
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

});
