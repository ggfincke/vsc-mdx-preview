// packages/extension/utils/lazy-import.test.ts
// unit tests for lazy import utility

import { describe, it, expect, vi } from 'vitest';
import { createLazyImport } from './lazy-import';

describe('createLazyImport', () => {
  it('should load module on first call', async () => {
    const mockModule = { value: 42 };
    const importFn = vi.fn().mockResolvedValue(mockModule);
    const getLazy = createLazyImport(importFn);

    const result = await getLazy();

    expect(importFn).toHaveBeenCalledTimes(1);
    expect(result).toBe(mockModule);
  });

  it('should cache module after first load', async () => {
    const mockModule = { value: 42 };
    const importFn = vi.fn().mockResolvedValue(mockModule);
    const getLazy = createLazyImport(importFn);

    const result1 = await getLazy();
    const result2 = await getLazy();
    const result3 = await getLazy();

    expect(importFn).toHaveBeenCalledTimes(1);
    expect(result1).toBe(mockModule);
    expect(result2).toBe(mockModule);
    expect(result3).toBe(mockModule);
  });

  it('should handle concurrent calls correctly', async () => {
    let resolveImport: (value: { value: number }) => void;
    const importFn = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveImport = resolve;
      })
    );

    const getLazy = createLazyImport(importFn);

    // start multiple concurrent calls
    const promise1 = getLazy();
    const promise2 = getLazy();
    const promise3 = getLazy();

    // should only call import function once
    expect(importFn).toHaveBeenCalledTimes(1);

    // resolve the import
    const mockModule = { value: 42 };
    resolveImport!(mockModule);

    // all promises should resolve to the same module
    const [result1, result2, result3] = await Promise.all([
      promise1,
      promise2,
      promise3,
    ]);

    expect(result1).toBe(mockModule);
    expect(result2).toBe(mockModule);
    expect(result3).toBe(mockModule);
  });

  it('should handle different module types', async () => {
    // test with a more complex module structure
    const mockModule = {
      default: () => 'default export',
      namedExport: () => 'named export',
      constant: 123,
    };
    const importFn = vi.fn().mockResolvedValue(mockModule);
    const getLazy = createLazyImport(importFn);

    const result = await getLazy();

    expect(result.default()).toBe('default export');
    expect(result.namedExport()).toBe('named export');
    expect(result.constant).toBe(123);
  });

  it('should propagate errors from import function', async () => {
    const importError = new Error('Failed to load module');
    const importFn = vi.fn().mockRejectedValue(importError);
    const getLazy = createLazyImport(importFn);

    await expect(getLazy()).rejects.toThrow('Failed to load module');
  });

  it('should create separate instances for different imports', async () => {
    const module1 = { name: 'module1' };
    const module2 = { name: 'module2' };

    const getLazy1 = createLazyImport(vi.fn().mockResolvedValue(module1));
    const getLazy2 = createLazyImport(vi.fn().mockResolvedValue(module2));

    const result1 = await getLazy1();
    const result2 = await getLazy2();

    expect(result1).toBe(module1);
    expect(result2).toBe(module2);
    expect(result1).not.toBe(result2);
  });
});
