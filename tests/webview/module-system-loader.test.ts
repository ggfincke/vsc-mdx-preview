// tests/webview/module-system-loader.test.ts
// unit tests for module-system lazy loader

import { describe, expect, it, vi } from 'vitest';
import {
  createModuleSystemLoader,
  type ModuleSystem,
} from '../../packages/webview-client/src/platform/rpc/module-system-loader';

describe('module-system-loader', () => {
  it('retries after sticky reject, dedupes concurrent loads, & resets', async () => {
    const firstRuntime = {
      ensureGenericShimsLoaded: vi.fn(),
      clearAllCaches: vi.fn(),
    } as unknown as ModuleSystem;
    const secondRuntime = {
      clearAllCaches: vi.fn(),
    } as unknown as ModuleSystem;
    const loadFn = vi
      .fn<() => Promise<ModuleSystem>>()
      .mockRejectedValueOnce(new Error('first failure'))
      .mockResolvedValueOnce(firstRuntime)
      .mockResolvedValueOnce(secondRuntime);
    const loader = createModuleSystemLoader(loadFn);

    await expect(loader.load()).rejects.toThrow('first failure');

    const [a, b] = await Promise.all([loader.load(), loader.load()]);
    expect(a).toBe(firstRuntime);
    expect(b).toBe(firstRuntime);
    expect(loadFn).toHaveBeenCalledTimes(2);

    loader.reset();
    await expect(loader.load()).resolves.toBe(secondRuntime);
    expect(loadFn).toHaveBeenCalledTimes(3);
  });
});
