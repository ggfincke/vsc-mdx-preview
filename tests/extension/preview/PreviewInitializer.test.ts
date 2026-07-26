// tests/extension/preview/PreviewInitializer.test.ts
// unit tests for preview initialization & watcher orchestration

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PreviewInitializer } from '../../../packages/extension-host/src/features/preview/PreviewInitializer';
import { WatcherManager } from '../../../packages/extension-host/src/features/preview/watchers/WatcherManager';
import { WEBVIEW_HANDSHAKE_TIMEOUT_MS } from '../../../packages/extension-host/src/shared/constants';
import {
  mockTailwindProcessor,
  mockConfigManager,
  mockConfigCache,
} from '../../helpers/mock-services';

const {
  configHandlers,
  mockGetConfigCandidatePaths,
  typescriptConfigHandlers,
} = vi.hoisted(() => ({
  configHandlers: [] as Array<(event: { configPath: string }) => void>,
  mockGetConfigCandidatePaths: vi.fn(),
  typescriptConfigHandlers: [] as Array<(configPath: string) => void>,
}));

vi.mock(
  '../../../packages/extension-host/src/features/preview/configuration/ConfigResolver',
  () => ({
    getConfigCandidatePaths: mockGetConfigCandidatePaths,
    onConfigChange: (handler: (event: { configPath: string }) => void) => {
      configHandlers.push(handler);
      return { dispose: vi.fn() };
    },
  })
);

vi.mock(
  '../../../packages/extension-host/src/features/preview/configuration/TypeScriptConfigResolver',
  () => ({
    onTypeScriptConfigChange: (handler: (configPath: string) => void) => {
      typescriptConfigHandlers.push(handler);
      return { dispose: vi.fn() };
    },
  })
);

describe('PreviewInitializer', () => {
  beforeEach(() => {
    configHandlers.length = 0;
    typescriptConfigHandlers.length = 0;
    mockGetConfigCandidatePaths.mockReturnValue([
      '/workspace/.mdx-previewrc.json',
      '/workspace/.mdx-previewrc',
    ]);
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
      expect.arrayContaining(['document', 'dependency', 'customCss'])
    );
  });

  it('subscribes file previews to valid & unresolved config candidates', () => {
    const initializer = new PreviewInitializer();
    const watcherManager = new WatcherManager();
    const onConfigChanged = vi.fn();

    initializer.setupConfigWatcher(
      watcherManager,
      'file',
      '/workspace/doc.mdx',
      onConfigChanged
    );

    expect(watcherManager.has('config')).toBe(true);
    expect(configHandlers.length).toBe(1);

    configHandlers[0]({ configPath: '/workspace/other.json' });
    expect(onConfigChanged).not.toHaveBeenCalled();

    configHandlers[0]({ configPath: '/workspace/.mdx-previewrc.json' });
    expect(onConfigChanged).toHaveBeenCalledTimes(1);

    mockGetConfigCandidatePaths.mockReturnValue([
      '/workspace/docs/.mdx-previewrc.json',
      '/workspace/docs/.mdx-previewrc',
      '/workspace/.mdx-previewrc.json',
      '/workspace/.mdx-previewrc',
    ]);
    const unresolvedWatcherManager = new WatcherManager();
    const onUnresolvedConfigChanged = vi.fn();

    initializer.setupConfigWatcher(
      unresolvedWatcherManager,
      'file',
      '/workspace/docs/doc.mdx',
      onUnresolvedConfigChanged
    );

    configHandlers[1]({
      configPath: '/workspace/other/.mdx-previewrc.json',
    });
    expect(onUnresolvedConfigChanged).not.toHaveBeenCalled();

    configHandlers[1]({
      configPath: '/workspace/docs/.mdx-previewrc.json',
    });
    configHandlers[1]({ configPath: '/workspace/.mdx-previewrc' });
    expect(onUnresolvedConfigChanged).toHaveBeenCalledTimes(2);
  });
});
