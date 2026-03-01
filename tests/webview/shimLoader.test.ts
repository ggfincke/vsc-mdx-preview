// tests/webview/shimLoader.test.ts
// Unit tests for shimLoader resilient loading w/ retry & fallback

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loadFrameworkShimsWithRetry,
} from '../../packages/webview-client/src/features/module-runtime/preload/shimLoader';
import type { ModuleRegistry } from 'mdx-forge/browser/registry';

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

vi.mock('../../packages/webview-client/src/app/constants', () => ({
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
      const frameworkLoader = vi
        .fn()
        .mockRejectedValue(new Error('Framework failed'));
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
});
