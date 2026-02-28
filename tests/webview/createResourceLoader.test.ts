// tests/webview/createResourceLoader.test.ts
// unit tests for resource loader wrapper behavior

import { describe, expect, it, vi } from 'vitest';

vi.mock(
  '../../packages/webview-client/src/shared/utils/createTaggedLogger',
  () => {
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    return {
      createTaggedLogger: () => logger,
    };
  }
);

import { createResourceLoader } from '../../packages/webview-client/src/shared/utils/createResourceLoader';

describe('createResourceLoader', () => {
  it('maintains load/isLoaded/isLoading/reset contract', async () => {
    let resolveLoad!: () => void;
    const loadPromise = new Promise<void>((resolve) => {
      resolveLoad = resolve;
    });
    const loadFn = vi.fn(async () => loadPromise);
    const loader = createResourceLoader(loadFn, {
      name: 'resource',
      allowRetry: true,
    });

    expect(loader.isLoaded()).toBe(false);
    expect(loader.isLoading()).toBe(false);

    const pending = loader.load();
    expect(loader.isLoading()).toBe(true);

    resolveLoad();
    await pending;

    expect(loader.isLoading()).toBe(false);
    expect(loader.isLoaded()).toBe(true);

    loader.reset();
    expect(loader.isLoaded()).toBe(false);
    expect(loader.isLoading()).toBe(false);
  });

  it('rejects immediately on retry-disabled loaders after first failure', async () => {
    const loadFn = vi.fn(async () => {
      throw new Error('initial failure');
    });
    const loader = createResourceLoader(loadFn, {
      name: 'no-retry-resource',
      allowRetry: false,
    });

    await expect(loader.load()).rejects.toThrow('initial failure');
    await expect(loader.load()).rejects.toThrow(
      '[no-retry-resource] Loading failed & retry is disabled'
    );
    expect(loadFn).toHaveBeenCalledTimes(1);
  });

  it('retries failed loads when retry is enabled', async () => {
    const loadFn = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('first failure'))
      .mockResolvedValueOnce(undefined);
    const loader = createResourceLoader(loadFn, {
      name: 'retry-resource',
      allowRetry: true,
    });

    await expect(loader.load()).rejects.toThrow('first failure');
    await expect(loader.load()).resolves.toBeUndefined();
    expect(loadFn).toHaveBeenCalledTimes(2);
  });
});
