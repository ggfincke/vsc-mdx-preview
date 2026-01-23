// tests/webview/katexLoader.test.ts
// Unit tests for KaTeX CSS lazy-loading

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the CSS import before importing the module
vi.mock('katex/dist/katex.min.css', () => ({}));

// Import after mock
import {
  loadKatexCss,
  isKatexCssLoaded,
  isKatexCssLoading,
  resetKatexLoader,
} from '../../packages/webview-app/src/utils/katexLoader';

describe('katexLoader', () => {
  beforeEach(() => {
    resetKatexLoader();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadKatexCss()', () => {
    it('should return a promise', () => {
      const result = loadKatexCss();
      expect(result).toBeInstanceOf(Promise);
    });

    it('should deduplicate concurrent calls by returning the same promise', async () => {
      const p1 = loadKatexCss();
      const p2 = loadKatexCss();

      // Should be the exact same promise instance
      expect(p1).toBe(p2);

      await p1;
      expect(isKatexCssLoaded()).toBe(true);
    });

    it('should return resolved promise when already loaded', async () => {
      // First load
      await loadKatexCss();
      expect(isKatexCssLoaded()).toBe(true);

      // Second call should return immediately resolved promise
      const p = loadKatexCss();
      await expect(p).resolves.toBeUndefined();
    });

    it('should set loaded state to true after successful load', async () => {
      expect(isKatexCssLoaded()).toBe(false);
      await loadKatexCss();
      expect(isKatexCssLoaded()).toBe(true);
    });
  });

  describe('isKatexCssLoaded()', () => {
    it('should return false before loading', () => {
      expect(isKatexCssLoaded()).toBe(false);
    });

    it('should return true after successful loading', async () => {
      await loadKatexCss();
      expect(isKatexCssLoaded()).toBe(true);
    });
  });

  describe('isKatexCssLoading()', () => {
    it('should return false before loading starts', () => {
      expect(isKatexCssLoading()).toBe(false);
    });

    it('should return true while loading is in progress', () => {
      // Start loading but don't await
      const promise = loadKatexCss();
      expect(isKatexCssLoading()).toBe(true);

      // Return the promise to ensure the test completes cleanly
      return promise;
    });

    it('should return false after loading completes', async () => {
      await loadKatexCss();
      expect(isKatexCssLoading()).toBe(false);
    });
  });

  describe('resetKatexLoader()', () => {
    it('should reset the loaded state', async () => {
      await loadKatexCss();
      expect(isKatexCssLoaded()).toBe(true);

      resetKatexLoader();
      expect(isKatexCssLoaded()).toBe(false);
      expect(isKatexCssLoading()).toBe(false);
    });

    it('should allow CSS to be loaded again after reset', async () => {
      await loadKatexCss();
      expect(isKatexCssLoaded()).toBe(true);

      resetKatexLoader();
      expect(isKatexCssLoaded()).toBe(false);

      await loadKatexCss();
      expect(isKatexCssLoaded()).toBe(true);
    });
  });
});
