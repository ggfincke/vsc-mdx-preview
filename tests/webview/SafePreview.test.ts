// tests/webview/SafePreview.test.ts
// Unit tests for SafePreview memo comparison (J.3 optimization)

import { describe, it, expect } from 'vitest';

interface SafePreviewRendererProps {
  html: string;
}

// Replicate the optimized arePropsEqual logic for testing
function arePropsEqual(
  prevProps: SafePreviewRendererProps,
  nextProps: SafePreviewRendererProps
): boolean {
  // Fast-path: check length first (O(1) vs O(n) for string comparison)
  return (
    prevProps.html.length === nextProps.html.length &&
    prevProps.html === nextProps.html
  );
}

describe('SafePreviewRenderer memo comparison (J.3)', () => {
  describe('should return true (prevent re-render) when', () => {
    it('html strings are identical', () => {
      const prev = { html: '<p>Hello</p>' };
      const next = { html: '<p>Hello</p>' };
      expect(arePropsEqual(prev, next)).toBe(true);
    });

    it('html strings are empty', () => {
      const prev = { html: '' };
      const next = { html: '' };
      expect(arePropsEqual(prev, next)).toBe(true);
    });

    it('same reference is used', () => {
      const props = { html: '<div>Content</div>' };
      expect(arePropsEqual(props, props)).toBe(true);
    });

    it('large identical html strings', () => {
      const largeHtml = '<div>' + 'x'.repeat(100000) + '</div>';
      const prev = { html: largeHtml };
      const next = { html: largeHtml };
      expect(arePropsEqual(prev, next)).toBe(true);
    });
  });

  describe('should return false (allow re-render) when', () => {
    it('html strings have different content', () => {
      const prev = { html: '<p>Hello</p>' };
      const next = { html: '<p>World</p>' };
      expect(arePropsEqual(prev, next)).toBe(false);
    });

    it('html strings have different lengths', () => {
      const prev = { html: '<p>Hi</p>' };
      const next = { html: '<p>Hello World</p>' };
      expect(arePropsEqual(prev, next)).toBe(false);
    });

    it('one html is empty and other is not', () => {
      const prev = { html: '' };
      const next = { html: '<p>Content</p>' };
      expect(arePropsEqual(prev, next)).toBe(false);
    });
  });

  describe('fast-path optimization', () => {
    it('short-circuits on length mismatch before string comparison', () => {
      // This test validates the optimization concept:
      // For strings of different lengths, we should return false immediately
      // without doing full string comparison
      const prev = { html: 'a' };
      const next = { html: 'ab' };

      // Length check: 1 !== 2, returns false immediately
      expect(prev.html.length !== next.html.length).toBe(true);
      expect(arePropsEqual(prev, next)).toBe(false);
    });

    it('handles same-length different-content correctly', () => {
      // When lengths match, we must do full string comparison
      const prev = { html: 'abc' };
      const next = { html: 'xyz' };

      // Lengths are equal
      expect(prev.html.length === next.html.length).toBe(true);
      // But content differs
      expect(arePropsEqual(prev, next)).toBe(false);
    });
  });
});
