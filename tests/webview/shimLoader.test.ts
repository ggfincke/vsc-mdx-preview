// tests/webview/shimLoader.test.ts
// Unit tests for shimLoader resilient loading with retry and fallback

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loadFrameworkShimsWithRetry,
  loadGenericShimsWithRetry,
  _retryLoadForTesting as retryLoad,
} from '../../packages/webview-app/src/module-system/preload/shimLoader';
import type { ModuleRegistry } from '../../packages/webview-app/src/module-system/registry/ModuleRegistry';

// Mock the debug function
vi.mock('../../packages/webview-app/src/utils/debug', () => ({
  debug: vi.fn(),
}));

// Mock the constants to speed up tests
vi.mock('../../packages/webview-app/src/constants', () => ({
  SHIM_LOAD_MAX_RETRIES: 2, // Reduce for faster tests
  SHIM_LOAD_RETRY_DELAY_MS: 10, // Faster delays for tests
}));

describe('shimLoader', () => {
  let mockRegistry: ModuleRegistry;

  beforeEach(() => {
    vi.useFakeTimers();
    mockRegistry = {
      preload: vi.fn(),
      get: vi.fn(),
      set: vi.fn(),
      has: vi.fn(),
    } as unknown as ModuleRegistry;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('retryLoad', () => {
    it('should succeed on first attempt', async () => {
      const loader = vi.fn().mockResolvedValue('success');

      const resultPromise = retryLoad('test', loader, 3);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.result).toBe('success');
      expect(result.attempts).toBe(1);
      expect(result.lastError).toBeUndefined();
      expect(loader).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and succeed', async () => {
      const loader = vi
        .fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce('success');

      const resultPromise = retryLoad('test', loader, 3);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.result).toBe('success');
      expect(result.attempts).toBe(2);
      expect(loader).toHaveBeenCalledTimes(2);
    });

    it('should return null after max retries', async () => {
      const error = new Error('Persistent failure');
      const loader = vi.fn().mockRejectedValue(error);

      const resultPromise = retryLoad('test', loader, 2);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.result).toBeNull();
      expect(result.attempts).toBe(3); // 0, 1, 2 = 3 attempts
      expect(result.lastError).toBe(error);
      expect(loader).toHaveBeenCalledTimes(3);
    });

    it('should handle string errors', async () => {
      const loader = vi.fn().mockRejectedValue('string error');

      const resultPromise = retryLoad('test', loader, 0);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.lastError).toBeInstanceOf(Error);
      expect(result.lastError?.message).toBe('string error');
    });

    it('should use exponential backoff', async () => {
      const loader = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValueOnce('success');

      const resultPromise = retryLoad('test', loader, 3);

      // First attempt happens immediately
      await vi.advanceTimersByTimeAsync(0);
      expect(loader).toHaveBeenCalledTimes(1);

      // First retry after 10ms (10 * 2^0)
      await vi.advanceTimersByTimeAsync(10);
      expect(loader).toHaveBeenCalledTimes(2);

      // Second retry after 20ms (10 * 2^1)
      await vi.advanceTimersByTimeAsync(20);
      expect(loader).toHaveBeenCalledTimes(3);

      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.result).toBe('success');
    });
  });

  describe('loadFrameworkShimsWithRetry', () => {
    it('should succeed on first attempt', async () => {
      const frameworkLoader = vi.fn().mockResolvedValue(undefined);
      const fallbackLoader = vi.fn();

      const resultPromise = loadFrameworkShimsWithRetry(
        mockRegistry,
        'docusaurus',
        frameworkLoader,
        fallbackLoader
      );
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.framework).toBe('docusaurus');
      expect(result.usedFallback).toBe(false);
      expect(result.failedShims).toEqual([]);
      expect(frameworkLoader).toHaveBeenCalledTimes(1);
      expect(fallbackLoader).not.toHaveBeenCalled();
    });

    it('should fall back to generic after max retries', async () => {
      const frameworkLoader = vi.fn().mockRejectedValue(new Error('Failed'));
      const fallbackLoader = vi.fn();

      const resultPromise = loadFrameworkShimsWithRetry(
        mockRegistry,
        'starlight',
        frameworkLoader,
        fallbackLoader
      );
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.usedFallback).toBe(true);
      expect(fallbackLoader).toHaveBeenCalledWith(mockRegistry);
    });

    it('should report failure when both framework and fallback fail', async () => {
      const frameworkLoader = vi.fn().mockRejectedValue(new Error('Framework failed'));
      const fallbackLoader = vi.fn().mockImplementation(() => {
        throw new Error('Fallback failed');
      });

      const resultPromise = loadFrameworkShimsWithRetry(
        mockRegistry,
        'nextra',
        frameworkLoader,
        fallbackLoader
      );
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.usedFallback).toBe(false);
      expect(result.failedShims).toContain('generic-fallback');
    });

    it('should skip for generic framework', async () => {
      const frameworkLoader = vi.fn();
      const fallbackLoader = vi.fn();

      const resultPromise = loadFrameworkShimsWithRetry(
        mockRegistry,
        'generic',
        frameworkLoader,
        fallbackLoader
      );
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(frameworkLoader).not.toHaveBeenCalled();
      expect(fallbackLoader).not.toHaveBeenCalled();
    });

    it('should retry framework loader before falling back', async () => {
      const frameworkLoader = vi
        .fn()
        .mockRejectedValueOnce(new Error('Attempt 1'))
        .mockRejectedValueOnce(new Error('Attempt 2'))
        .mockRejectedValueOnce(new Error('Attempt 3'));
      const fallbackLoader = vi.fn();

      const resultPromise = loadFrameworkShimsWithRetry(
        mockRegistry,
        'docusaurus',
        frameworkLoader,
        fallbackLoader
      );
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      // With SHIM_LOAD_MAX_RETRIES = 2, we get 3 attempts (0, 1, 2)
      expect(frameworkLoader).toHaveBeenCalledTimes(3);
      expect(result.usedFallback).toBe(true);
    });
  });

  describe('loadGenericShimsWithRetry', () => {
    it('should load all shims successfully', async () => {
      const shimLoaders = {
        Tabs: vi.fn().mockResolvedValue(undefined),
        Callout: vi.fn().mockResolvedValue(undefined),
      };

      const resultPromise = loadGenericShimsWithRetry(
        mockRegistry,
        ['Tabs', 'Callout'],
        shimLoaders
      );
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.loaded).toContain('Tabs');
      expect(result.loaded).toContain('Callout');
      expect(result.failed).toEqual([]);
    });

    it('should report individual failures', async () => {
      const shimLoaders = {
        Tabs: vi.fn().mockResolvedValue(undefined),
        Callout: vi.fn().mockRejectedValue(new Error('Failed')),
      };

      const resultPromise = loadGenericShimsWithRetry(
        mockRegistry,
        ['Tabs', 'Callout'],
        shimLoaders
      );
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.loaded).toContain('Tabs');
      expect(result.failed).toContain('Callout');
    });

    it('should skip components without loaders', async () => {
      const shimLoaders = {
        Tabs: vi.fn().mockResolvedValue(undefined),
        // No loader for 'MissingComponent'
      };

      const resultPromise = loadGenericShimsWithRetry(
        mockRegistry,
        ['Tabs', 'MissingComponent'],
        shimLoaders
      );
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.loaded).toContain('Tabs');
      // MissingComponent should not be in loaded or failed (no loader)
      expect(result.loaded).not.toContain('MissingComponent');
      expect(result.failed).not.toContain('MissingComponent');
    });

    it('should load shims in parallel', async () => {
      let tabsStarted = false;
      let calloutStarted = false;
      let tabsFinished = false;
      let calloutFinished = false;

      const shimLoaders = {
        Tabs: vi.fn().mockImplementation(async () => {
          tabsStarted = true;
          await new Promise((r) => setTimeout(r, 50));
          tabsFinished = true;
        }),
        Callout: vi.fn().mockImplementation(async () => {
          calloutStarted = true;
          await new Promise((r) => setTimeout(r, 50));
          calloutFinished = true;
        }),
      };

      const resultPromise = loadGenericShimsWithRetry(
        mockRegistry,
        ['Tabs', 'Callout'],
        shimLoaders
      );

      // Both should start before either finishes
      await vi.advanceTimersByTimeAsync(10);
      expect(tabsStarted).toBe(true);
      expect(calloutStarted).toBe(true);
      expect(tabsFinished).toBe(false);
      expect(calloutFinished).toBe(false);

      await vi.runAllTimersAsync();
      await resultPromise;

      expect(tabsFinished).toBe(true);
      expect(calloutFinished).toBe(true);
    });

    it('should retry individual shims independently', async () => {
      const shimLoaders = {
        Tabs: vi.fn().mockResolvedValue(undefined),
        Callout: vi
          .fn()
          .mockRejectedValueOnce(new Error('Attempt 1'))
          .mockResolvedValueOnce(undefined),
      };

      const resultPromise = loadGenericShimsWithRetry(
        mockRegistry,
        ['Tabs', 'Callout'],
        shimLoaders
      );
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      // Tabs should be called once (success), Callout twice (fail, then success)
      expect(shimLoaders.Tabs).toHaveBeenCalledTimes(1);
      expect(shimLoaders.Callout).toHaveBeenCalledTimes(2);
      expect(result.loaded).toContain('Tabs');
      expect(result.loaded).toContain('Callout');
      expect(result.failed).toEqual([]);
    });

    it('should handle empty component list', async () => {
      const shimLoaders = {
        Tabs: vi.fn(),
      };

      const resultPromise = loadGenericShimsWithRetry(mockRegistry, [], shimLoaders);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.loaded).toEqual([]);
      expect(result.failed).toEqual([]);
      expect(shimLoaders.Tabs).not.toHaveBeenCalled();
    });
  });
});
