// tests/webview/module-system-loader.test.ts
// unit tests for module-system lazy loader

import { describe, expect, it, vi } from 'vitest';
import {
  createModuleSystemLoader,
  type ModuleSystem,
} from '../../packages/webview-client/src/platform/rpc/module-system-loader';

describe('module-system-loader', () => {
  it('deduplicates concurrent loads', async () => {
    const runtime = {
      ensureFrameworkShimsLoaded: vi.fn(),
    } as unknown as ModuleSystem;
    const loadFn = vi.fn(async () => runtime);
    const loader = createModuleSystemLoader(loadFn);

    const [a, b] = await Promise.all([loader.load(), loader.load()]);

    expect(a).toBe(runtime);
    expect(b).toBe(runtime);
    expect(loadFn).toHaveBeenCalledTimes(1);
  });

  it('retries load after failure', async () => {
    const runtime = {
      ensureGenericShimsLoaded: vi.fn(),
    } as unknown as ModuleSystem;
    const loadFn = vi
      .fn<() => Promise<ModuleSystem>>()
      .mockRejectedValueOnce(new Error('first failure'))
      .mockResolvedValueOnce(runtime);
    const loader = createModuleSystemLoader(loadFn);

    await expect(loader.load()).rejects.toThrow('first failure');
    await expect(loader.load()).resolves.toBe(runtime);
    expect(loadFn).toHaveBeenCalledTimes(2);
  });

  it('reset forces reload after success', async () => {
    const firstRuntime = {
      clearAllCaches: vi.fn(),
    } as unknown as ModuleSystem;
    const secondRuntime = {
      clearAllCaches: vi.fn(),
    } as unknown as ModuleSystem;
    const loadFn = vi
      .fn<() => Promise<ModuleSystem>>()
      .mockResolvedValueOnce(firstRuntime)
      .mockResolvedValueOnce(secondRuntime);
    const loader = createModuleSystemLoader(loadFn);

    await expect(loader.load()).resolves.toBe(firstRuntime);
    loader.reset();
    await expect(loader.load()).resolves.toBe(secondRuntime);
    expect(loadFn).toHaveBeenCalledTimes(2);
  });
});
