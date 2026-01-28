// tests/webview/createResourceLoader.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createResourceLoader } from '../../packages/webview-app/src/utils/createResourceLoader';

describe('createResourceLoader', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('basic loading', () => {
    it('should call loadFn on first load()', async () => {
      const loadFn = vi.fn().mockResolvedValue(undefined);
      const loader = createResourceLoader(loadFn, { name: 'Test' });

      await loader.load();

      expect(loadFn).toHaveBeenCalledTimes(1);
    });

    it('should not call loadFn on subsequent loads after success', async () => {
      const loadFn = vi.fn().mockResolvedValue(undefined);
      const loader = createResourceLoader(loadFn, { name: 'Test' });

      await loader.load();
      await loader.load();
      await loader.load();

      expect(loadFn).toHaveBeenCalledTimes(1);
    });

    it('should return immediately for already loaded resource', async () => {
      let callCount = 0;
      const loadFn = vi.fn(async () => {
        callCount++;
        // Simulate slow load
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
      const loader = createResourceLoader(loadFn, { name: 'Test' });

      await loader.load();
      expect(callCount).toBe(1);

      // Second call should return immediately without incrementing count
      const start = Date.now();
      await loader.load();
      const elapsed = Date.now() - start;

      expect(callCount).toBe(1);
      expect(elapsed).toBeLessThan(5); // Should be essentially instant
    });
  });

  describe('concurrent calls deduplication', () => {
    it('should return the same promise for concurrent calls', async () => {
      let resolveLoad: () => void;
      const loadPromise = new Promise<void>((resolve) => {
        resolveLoad = resolve;
      });
      const loadFn = vi.fn().mockReturnValue(loadPromise);
      const loader = createResourceLoader(loadFn, { name: 'Test' });

      // Start two concurrent loads
      const promise1 = loader.load();
      const promise2 = loader.load();

      // Should return the same promise
      expect(promise1).toBe(promise2);
      expect(loadFn).toHaveBeenCalledTimes(1);

      // Resolve and verify
      resolveLoad!();
      await Promise.all([promise1, promise2]);
    });

    it('should handle multiple concurrent calls efficiently', async () => {
      const loadFn = vi.fn().mockResolvedValue(undefined);
      const loader = createResourceLoader(loadFn, { name: 'Test' });

      // Start many concurrent loads
      const promises = Array.from({ length: 10 }, () => loader.load());

      await Promise.all(promises);

      // Should only call loadFn once
      expect(loadFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('state tracking', () => {
    it('should report isLoaded() correctly', async () => {
      const loadFn = vi.fn().mockResolvedValue(undefined);
      const loader = createResourceLoader(loadFn, { name: 'Test' });

      expect(loader.isLoaded()).toBe(false);

      await loader.load();

      expect(loader.isLoaded()).toBe(true);
    });

    it('should report isLoading() correctly', async () => {
      let resolveLoad: () => void;
      const loadPromise = new Promise<void>((resolve) => {
        resolveLoad = resolve;
      });
      const loadFn = vi.fn().mockReturnValue(loadPromise);
      const loader = createResourceLoader(loadFn, { name: 'Test' });

      expect(loader.isLoading()).toBe(false);

      const promise = loader.load();
      expect(loader.isLoading()).toBe(true);

      resolveLoad!();
      await promise;

      expect(loader.isLoading()).toBe(false);
    });

    it('should report both isLoaded() and isLoading() as false initially', () => {
      const loadFn = vi.fn().mockResolvedValue(undefined);
      const loader = createResourceLoader(loadFn, { name: 'Test' });

      expect(loader.isLoaded()).toBe(false);
      expect(loader.isLoading()).toBe(false);
    });
  });

  describe('error handling and retry', () => {
    it('should allow retry after failure by default', async () => {
      const loadFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('First fail'))
        .mockResolvedValueOnce(undefined);
      const loader = createResourceLoader(loadFn, { name: 'Test' });

      // First attempt fails
      await expect(loader.load()).rejects.toThrow('First fail');
      expect(loader.isLoaded()).toBe(false);

      // Second attempt succeeds
      await loader.load();
      expect(loader.isLoaded()).toBe(true);
      expect(loadFn).toHaveBeenCalledTimes(2);
    });

    it('should reject without retry when allowRetry is false', async () => {
      const loadFn = vi.fn().mockRejectedValue(new Error('Load failed'));
      const loader = createResourceLoader(loadFn, {
        name: 'Test',
        allowRetry: false,
      });

      // First attempt fails
      await expect(loader.load()).rejects.toThrow('Load failed');

      // Second attempt should also reject (without calling loadFn again)
      await expect(loader.load()).rejects.toThrow('retry is disabled');
      expect(loadFn).toHaveBeenCalledTimes(1);
    });

    it('should not mark as loaded after failure', async () => {
      const loadFn = vi.fn().mockRejectedValue(new Error('Failed'));
      const loader = createResourceLoader(loadFn, { name: 'Test' });

      await expect(loader.load()).rejects.toThrow();

      expect(loader.isLoaded()).toBe(false);
      expect(loader.isLoading()).toBe(false);
    });
  });

  describe('reset', () => {
    it('should allow reload after reset', async () => {
      const loadFn = vi.fn().mockResolvedValue(undefined);
      const loader = createResourceLoader(loadFn, { name: 'Test' });

      await loader.load();
      expect(loadFn).toHaveBeenCalledTimes(1);

      loader.reset();
      expect(loader.isLoaded()).toBe(false);

      await loader.load();
      expect(loadFn).toHaveBeenCalledTimes(2);
    });

    it('should reset failed state', async () => {
      const loadFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce(undefined);
      const loader = createResourceLoader(loadFn, { name: 'Test' });

      await expect(loader.load()).rejects.toThrow();

      loader.reset();
      expect(loader.isLoaded()).toBe(false);
      expect(loader.isLoading()).toBe(false);

      // Should succeed now
      await loader.load();
      expect(loader.isLoaded()).toBe(true);
    });
  });
});
