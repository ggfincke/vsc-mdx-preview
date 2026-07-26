// tests/webview/shimLoader.test.ts
// Unit tests for shimLoader resilient loading w/ retry & fallback

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadFrameworkShimsWithRetry } from '../../packages/webview-client/src/features/module-runtime/preload/shimLoader';
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

// mock the retry seam consumed by ensureGenericShims so we drive load outcomes
const mockLoadGenericShimsWithRetry = vi.fn();
vi.mock(
  '../../packages/webview-client/src/features/module-runtime/preload/shimLoader',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('../../packages/webview-client/src/features/module-runtime/preload/shimLoader')
      >();
    return {
      ...actual,
      loadGenericShimsWithRetry: (...args: unknown[]) =>
        mockLoadGenericShimsWithRetry(...args),
    };
  }
);

// stub generated preload tables (index.ts imports them at module load)
vi.mock(
  '../../packages/webview-client/src/generated/preload/preload.generated',
  () => ({
    preloadGenericShims: vi.fn(),
    GENERIC_SHIM_LOADERS: { Callout: vi.fn() },
    FRAMEWORK_LOADERS: {},
  })
);

vi.mock(
  '../../packages/webview-client/src/generated/preload/aliases.generated',
  () => ({
    PRELOADED_SHIM_IDS: [],
  })
);

vi.mock(
  '../../packages/webview-client/src/generated/framework-css/frameworkCssLoader',
  () => ({
    loadFrameworkCss: vi.fn(),
    isFrameworkCssLoaded: vi.fn(),
    resetFrameworkCssLoader: vi.fn(),
  })
);

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

      expect(result.success).toBe(false);
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

  describe('ensureGenericShims retry after failed load', () => {
    it('retries on a second call when the first load rejects', async () => {
      // first load rejects -> stale promise must be cleared in finally
      // second call must attempt loading again (not await a rejected promise)
      mockLoadGenericShimsWithRetry
        .mockRejectedValueOnce(new Error('generic shim load failed'))
        .mockResolvedValueOnce({ loaded: ['Callout'], failed: [] });

      const { ensureGenericShims } =
        await import('../../packages/webview-client/src/features/module-runtime/preload/index');

      await expect(
        ensureGenericShims(mockRegistry, ['Callout'])
      ).rejects.toThrow('generic shim load failed');

      // second call retries the load rather than returning a stuck rejection
      await expect(
        ensureGenericShims(mockRegistry, ['Callout'])
      ).resolves.toBeUndefined();

      expect(mockLoadGenericShimsWithRetry).toHaveBeenCalledTimes(2);
    });
  });
});
