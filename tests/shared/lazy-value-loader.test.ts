// tests/shared/lazy-value-loader.test.ts
// unit tests for shared lazy value loader behavior

import { describe, expect, it, vi } from 'vitest';
import { createLazyValueLoader } from '@mdx-preview/runtime-utils';

describe('createLazyValueLoader', () => {
  it('deduplicates concurrent load calls', async () => {
    const loadFn = vi.fn(async () => 'value');
    const loader = createLazyValueLoader(loadFn, { allowRetry: true });

    const [a, b] = await Promise.all([loader.load(), loader.load()]);

    expect(a).toBe('value');
    expect(b).toBe('value');
    expect(loadFn).toHaveBeenCalledTimes(1);
  });

  it('reuses cached value after successful load', async () => {
    const loadFn = vi.fn(async () => ({ ok: true }));
    const loader = createLazyValueLoader(loadFn, { allowRetry: true });

    const first = await loader.load();
    const second = await loader.load();

    expect(first).toBe(second);
    expect(loadFn).toHaveBeenCalledTimes(1);
    expect(loader.isLoaded()).toBe(true);
  });

  it('is fail-sticky when retry is disabled', async () => {
    const error = new Error('boom');
    const loadFn = vi.fn(async () => {
      throw error;
    });
    const loader = createLazyValueLoader(loadFn, { allowRetry: false });

    await expect(loader.load()).rejects.toBe(error);
    await expect(loader.load()).rejects.toBe(error);
    expect(loadFn).toHaveBeenCalledTimes(1);
  });

  it('retries on subsequent load when retry is enabled', async () => {
    const error = new Error('first-failure');
    const loadFn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce('ok');
    const loader = createLazyValueLoader(loadFn, { allowRetry: true });

    await expect(loader.load()).rejects.toBe(error);
    await expect(loader.load()).resolves.toBe('ok');
    expect(loadFn).toHaveBeenCalledTimes(2);
  });

  it('reset clears cached success and allows fresh load', async () => {
    const loadFn = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce('first')
      .mockResolvedValueOnce('second');
    const loader = createLazyValueLoader(loadFn, { allowRetry: true });

    await expect(loader.load()).resolves.toBe('first');
    loader.reset();
    await expect(loader.load()).resolves.toBe('second');

    expect(loadFn).toHaveBeenCalledTimes(2);
  });

  it('prevents stale in-flight completion from overwriting newer generation', async () => {
    let resolveFirst!: (value: string) => void;
    const firstPromise = new Promise<string>((resolve) => {
      resolveFirst = resolve;
    });
    const loadFn = vi
      .fn<() => Promise<string>>()
      .mockImplementationOnce(() => firstPromise)
      .mockResolvedValueOnce('second');
    const loader = createLazyValueLoader(loadFn, { allowRetry: true });

    const staleLoad = loader.load();
    loader.reset();

    await expect(loader.load()).resolves.toBe('second');

    resolveFirst('first');
    await expect(staleLoad).resolves.toBe('first');

    // verify stale completion does not overwrite state
    await expect(loader.load()).resolves.toBe('second');
    expect(loadFn).toHaveBeenCalledTimes(2);
  });
});
