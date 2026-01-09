// packages/webview-app/src/test/themeLoader.test.ts
// tests for theme CSS injection utilities

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  injectPreviewTheme,
  injectCodeBlockTheme,
  clearThemeStyles,
} from '../utils/themeLoader';

describe('themeLoader', () => {
  beforeEach(() => {
    // clean up any existing theme styles
    clearThemeStyles();
  });

  afterEach(() => {
    // clean up after each test
    clearThemeStyles();
  });

  describe('injectPreviewTheme', () => {
    it('creates style element if not exists', () => {
      injectPreviewTheme('github-light');

      const styleEl = document.getElementById('mpe-preview-theme');
      expect(styleEl).not.toBeNull();
      expect(styleEl?.tagName).toBe('STYLE');
    });

    it('reuses existing style element', () => {
      injectPreviewTheme('github-light');
      const firstEl = document.getElementById('mpe-preview-theme');

      injectPreviewTheme('github-dark');
      const secondEl = document.getElementById('mpe-preview-theme');

      expect(firstEl).toBe(secondEl);
    });

    it('sets data-mpe-preview-theme attribute on documentElement', () => {
      injectPreviewTheme('github-light');

      expect(
        document.documentElement.getAttribute('data-mpe-preview-theme')
      ).toBe('github-light');
    });

    it('updates data attribute when theme changes', () => {
      injectPreviewTheme('github-light');
      injectPreviewTheme('github-dark');

      expect(
        document.documentElement.getAttribute('data-mpe-preview-theme')
      ).toBe('github-dark');
    });

    it('handles "none" theme', () => {
      injectPreviewTheme('none');

      expect(
        document.documentElement.getAttribute('data-mpe-preview-theme')
      ).toBe('none');
    });
  });

  describe('injectCodeBlockTheme', () => {
    it('creates style element if not exists', () => {
      injectCodeBlockTheme('github', true);

      const styleEl = document.getElementById('mpe-code-block-theme');
      expect(styleEl).not.toBeNull();
      expect(styleEl?.tagName).toBe('STYLE');
    });

    it('sets data-mpe-code-block-theme attribute', () => {
      injectCodeBlockTheme('github-dark', false);

      expect(
        document.documentElement.getAttribute('data-mpe-code-block-theme')
      ).toBe('github-dark');
    });

    it('handles auto theme in light mode', () => {
      injectCodeBlockTheme('auto', true);

      // auto + light = github
      expect(
        document.documentElement.getAttribute('data-mpe-code-block-theme')
      ).toBe('github');
    });

    it('handles auto theme in dark mode', () => {
      injectCodeBlockTheme('auto', false);

      // auto + dark = github-dark
      expect(
        document.documentElement.getAttribute('data-mpe-code-block-theme')
      ).toBe('github-dark');
    });

    it('uses explicit theme regardless of isLight', () => {
      injectCodeBlockTheme('monokai', true);

      expect(
        document.documentElement.getAttribute('data-mpe-code-block-theme')
      ).toBe('monokai');
    });
  });

  describe('clearThemeStyles', () => {
    it('removes preview theme style element', () => {
      injectPreviewTheme('github-light');
      clearThemeStyles();

      expect(document.getElementById('mpe-preview-theme')).toBeNull();
    });

    it('removes code block theme style element', () => {
      injectCodeBlockTheme('github', true);
      clearThemeStyles();

      expect(document.getElementById('mpe-code-block-theme')).toBeNull();
    });

    it('removes data-mpe-preview-theme attribute', () => {
      injectPreviewTheme('github-light');
      clearThemeStyles();

      expect(
        document.documentElement.getAttribute('data-mpe-preview-theme')
      ).toBeNull();
    });

    it('removes data-mpe-code-block-theme attribute', () => {
      injectCodeBlockTheme('github', true);
      clearThemeStyles();

      expect(
        document.documentElement.getAttribute('data-mpe-code-block-theme')
      ).toBeNull();
    });

    it('is safe to call when no themes injected', () => {
      expect(() => clearThemeStyles()).not.toThrow();
    });
  });
});
