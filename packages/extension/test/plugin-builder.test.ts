// packages/extension/test/plugin-builder.test.ts
// unit tests for plugin-builder (plugin pipeline construction)

import { describe, it, expect } from 'vitest';
import type { Pluggable } from 'unified';
import {
  buildTrustedRemarkPlugins,
  buildTrustedRehypePlugins,
  buildTrustedPluginPipeline,
  getSafeRemarkPlugins,
  getSafeRehypePluginSets,
  REHYPE_RAW_CONFIG,
} from '../transpiler/mdx/plugin-builder';
import type { LoadedPlugins } from '../transpiler/plugin-loader';

// Mock plugins for testing
const mockRemarkPlugin: Pluggable = () => {};
const mockRehypePlugin: Pluggable = () => {};

describe('plugin-builder', () => {
  describe('REHYPE_RAW_CONFIG', () => {
    it('has MDX passthrough nodes configured', () => {
      expect(REHYPE_RAW_CONFIG.passThrough).toContain('mdxJsxFlowElement');
      expect(REHYPE_RAW_CONFIG.passThrough).toContain('mdxJsxTextElement');
      expect(REHYPE_RAW_CONFIG.passThrough).toContain('mdxFlowExpression');
      expect(REHYPE_RAW_CONFIG.passThrough).toContain('mdxTextExpression');
      expect(REHYPE_RAW_CONFIG.passThrough).toContain('mdxjsEsm');
    });
  });

  describe('buildTrustedRemarkPlugins', () => {
    it('returns shared plugins when no custom plugins provided', () => {
      const customPlugins: LoadedPlugins = {
        remarkPlugins: [],
        rehypePlugins: [],
        errors: [],
      };

      const result = buildTrustedRemarkPlugins(customPlugins);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('appends custom remark plugins to shared plugins', () => {
      const customPlugins: LoadedPlugins = {
        remarkPlugins: [mockRemarkPlugin],
        rehypePlugins: [],
        errors: [],
      };

      const result = buildTrustedRemarkPlugins(customPlugins);

      // Custom plugin should be at the end
      expect(result[result.length - 1]).toBe(mockRemarkPlugin);
    });

    it('preserves shared plugins order', () => {
      const customPlugins: LoadedPlugins = {
        remarkPlugins: [mockRemarkPlugin],
        rehypePlugins: [],
        errors: [],
      };

      const withoutCustom = buildTrustedRemarkPlugins({
        remarkPlugins: [],
        rehypePlugins: [],
        errors: [],
      });
      const withCustom = buildTrustedRemarkPlugins(customPlugins);

      // First N plugins should be the same (shared plugins)
      for (let i = 0; i < withoutCustom.length; i++) {
        expect(withCustom[i]).toBe(withoutCustom[i]);
      }
    });
  });

  describe('buildTrustedRehypePlugins', () => {
    it('returns base plugins when no custom plugins provided', () => {
      const customPlugins: LoadedPlugins = {
        remarkPlugins: [],
        rehypePlugins: [],
        errors: [],
      };

      const result = buildTrustedRehypePlugins(customPlugins);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('appends custom rehype plugins to base plugins', () => {
      const customPlugins: LoadedPlugins = {
        remarkPlugins: [],
        rehypePlugins: [mockRehypePlugin],
        errors: [],
      };

      const result = buildTrustedRehypePlugins(customPlugins);

      // Custom plugin should be at the end
      expect(result[result.length - 1]).toBe(mockRehypePlugin);
    });

    it('includes rehype-raw as first plugin', () => {
      const customPlugins: LoadedPlugins = {
        remarkPlugins: [],
        rehypePlugins: [],
        errors: [],
      };

      const result = buildTrustedRehypePlugins(customPlugins);

      // first plugin should be rehype-raw w/ config
      expect(Array.isArray(result[0])).toBe(true);
      expect((result[0] as [unknown, unknown])[1]).toBe(REHYPE_RAW_CONFIG);
    });
  });

  describe('buildTrustedPluginPipeline', () => {
    it('returns both remark and rehype plugin arrays', () => {
      const customPlugins: LoadedPlugins = {
        remarkPlugins: [],
        rehypePlugins: [],
        errors: [],
      };

      const result = buildTrustedPluginPipeline(customPlugins);

      expect(result).toHaveProperty('remarkPlugins');
      expect(result).toHaveProperty('rehypePlugins');
      expect(Array.isArray(result.remarkPlugins)).toBe(true);
      expect(Array.isArray(result.rehypePlugins)).toBe(true);
    });

    it('includes custom plugins in both arrays', () => {
      const customPlugins: LoadedPlugins = {
        remarkPlugins: [mockRemarkPlugin],
        rehypePlugins: [mockRehypePlugin],
        errors: [],
      };

      const result = buildTrustedPluginPipeline(customPlugins);

      expect(result.remarkPlugins).toContain(mockRemarkPlugin);
      expect(result.rehypePlugins).toContain(mockRehypePlugin);
    });
  });

  describe('getSafeRemarkPlugins', () => {
    it('returns shared remark plugins array', () => {
      const result = getSafeRemarkPlugins();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('returns same array as buildTrustedRemarkPlugins with no custom plugins', () => {
      const safePlugins = getSafeRemarkPlugins();
      const trustedPlugins = buildTrustedRemarkPlugins({
        remarkPlugins: [],
        rehypePlugins: [],
        errors: [],
      });

      expect(safePlugins).toEqual(trustedPlugins);
    });
  });

  describe('getSafeRehypePluginSets', () => {
    it('returns preMath, math, and postMath plugin sets', () => {
      const result = getSafeRehypePluginSets();

      expect(result).toHaveProperty('preMath');
      expect(result).toHaveProperty('math');
      expect(result).toHaveProperty('postMath');
    });

    it('returns arrays for preMath and postMath', () => {
      const result = getSafeRehypePluginSets();

      expect(Array.isArray(result.preMath)).toBe(true);
      expect(Array.isArray(result.postMath)).toBe(true);
    });

    it('returns a single plugin for math', () => {
      const result = getSafeRehypePluginSets();

      // math should be a single pluggable (function or array tuple)
      expect(
        typeof result.math === 'function' || Array.isArray(result.math)
      ).toBe(true);
    });
  });
});
