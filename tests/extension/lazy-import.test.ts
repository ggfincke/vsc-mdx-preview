// tests/extension/lazy-import.test.ts
// regression tests for extension createLazyImport fail-sticky behavior

import { describe, expect, it, vi } from 'vitest';
import { createLazyImport } from '../../packages/extension-host/src/shared/utils/lazy-import';

describe('createLazyImport', () => {
  it('deduplicates concurrent import calls', async () => {
    const value = { ok: true };
    const importFn = vi.fn(async () => value);
    const getValue = createLazyImport(importFn);

    const [a, b] = await Promise.all([getValue(), getValue()]);

    expect(a).toBe(value);
    expect(b).toBe(value);
    expect(importFn).toHaveBeenCalledTimes(1);
  });

  it('stays fail-sticky after first import failure', async () => {
    const error = new Error('load failed');
    const importFn = vi.fn(async () => {
      throw error;
    });
    const getValue = createLazyImport(importFn);

    await expect(getValue()).rejects.toBe(error);
    await expect(getValue()).rejects.toBe(error);
    expect(importFn).toHaveBeenCalledTimes(1);
  });
});
