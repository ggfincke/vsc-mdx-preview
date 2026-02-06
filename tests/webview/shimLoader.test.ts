// tests/webview/shimLoader.test.ts
// Unit tests for shimLoader resilient loading w/ retry & fallback

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loadFrameworkShimsWithRetry,
  loadGenericShimsWithRetry,
} from '../../packages/webview-app/src/module-system/preload/shimLoader';
import type { ModuleRegistry } from '../../packages/webview-app/src/module-system/registry/ModuleRegistry';

vi.mock('../../packages/webview-app/src/utils/debug', () => {
  const debug = vi.fn();
  const info = vi.fn();
  const warn = vi.fn();
  const error = vi.fn();

  return {
    debug,
    info,
    warn,
    error,
    logger: {
      debug,
      info,
      warn,
      error,
    },
  };
});

vi.mock('../../packages/webview-app/src/constants', () => ({
  SHIM_LOAD_MAX_RETRIES: 2,
  SHIM_LOAD_RETRY_DELAY_MS: 10,
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

    it('should retry individual shims on failure', async () => {
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

      expect(shimLoaders.Tabs).toHaveBeenCalledTimes(1);
      expect(shimLoaders.Callout).toHaveBeenCalledTimes(2);
      expect(result.loaded).toContain('Callout');
      expect(result.failed).toEqual([]);
    });
  });
});
