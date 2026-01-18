// packages/shared-types/__tests__/index.test.ts
// unit tests for shared-types

import { describe, it, expect } from 'vitest';
import {
  isPreviewError,
  isLightPreviewTheme,
  getOppositeTheme,
  PREVIEW_THEMES,
  CODE_BLOCK_THEMES,
  THEME_PAIRS,
  type PreviewTheme,
  type PreviewError,
  type TrustState,
  type WebviewThemeState,
  type FetchResult,
} from '../index';

describe('shared-types', () => {
  describe('isPreviewError()', () => {
    it('returns true for valid PreviewError', () => {
      const error: PreviewError = {
        message: 'Test error',
        stack: 'Error: Test error\n    at test.ts:1:1',
        code: 'TEST_ERROR',
      };

      expect(isPreviewError(error)).toBe(true);
    });

    it('returns true for PreviewError with only message', () => {
      const error = { message: 'Test error' };

      expect(isPreviewError(error)).toBe(true);
    });

    it('returns false for null', () => {
      expect(isPreviewError(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isPreviewError(undefined)).toBe(false);
    });

    it('returns false for object without message', () => {
      expect(isPreviewError({ stack: 'some stack' })).toBe(false);
    });

    it('returns false for object with non-string message', () => {
      expect(isPreviewError({ message: 123 })).toBe(false);
      expect(isPreviewError({ message: null })).toBe(false);
      expect(isPreviewError({ message: {} })).toBe(false);
    });

    it('returns false for primitive values', () => {
      expect(isPreviewError('error')).toBe(false);
      expect(isPreviewError(123)).toBe(false);
      expect(isPreviewError(true)).toBe(false);
    });

    it('returns false for array', () => {
      expect(isPreviewError(['message'])).toBe(false);
    });
  });

  describe('isLightPreviewTheme()', () => {
    it('returns true for themes containing "light"', () => {
      expect(isLightPreviewTheme('github-light')).toBe(true);
      expect(isLightPreviewTheme('atom-light')).toBe(true);
      expect(isLightPreviewTheme('one-light')).toBe(true);
      expect(isLightPreviewTheme('solarized-light')).toBe(true);
    });

    it('returns true for special light themes', () => {
      expect(isLightPreviewTheme('medium')).toBe(true);
      expect(isLightPreviewTheme('newsprint')).toBe(true);
      expect(isLightPreviewTheme('gothic')).toBe(true);
      expect(isLightPreviewTheme('none')).toBe(true);
      expect(isLightPreviewTheme('vue')).toBe(true);
    });

    it('returns false for dark themes', () => {
      expect(isLightPreviewTheme('github-dark')).toBe(false);
      expect(isLightPreviewTheme('atom-dark')).toBe(false);
      expect(isLightPreviewTheme('one-dark')).toBe(false);
      expect(isLightPreviewTheme('solarized-dark')).toBe(false);
      expect(isLightPreviewTheme('monokai')).toBe(false);
      expect(isLightPreviewTheme('night')).toBe(false);
    });

    it('returns false for atom-material (dark theme)', () => {
      expect(isLightPreviewTheme('atom-material')).toBe(false);
    });
  });

  describe('getOppositeTheme()', () => {
    it('returns dark variant for light theme', () => {
      expect(getOppositeTheme('github-light', false)).toBe('github-dark');
      expect(getOppositeTheme('atom-light', false)).toBe('atom-dark');
      expect(getOppositeTheme('one-light', false)).toBe('one-dark');
      expect(getOppositeTheme('solarized-light', false)).toBe('solarized-dark');
    });

    it('returns light variant for dark theme', () => {
      expect(getOppositeTheme('github-dark', true)).toBe('github-light');
      expect(getOppositeTheme('atom-dark', true)).toBe('atom-light');
      expect(getOppositeTheme('one-dark', true)).toBe('one-light');
      expect(getOppositeTheme('solarized-dark', true)).toBe('solarized-light');
    });

    it('returns same theme if no pair exists', () => {
      expect(getOppositeTheme('monokai', true)).toBe('monokai');
      expect(getOppositeTheme('monokai', false)).toBe('monokai');
      expect(getOppositeTheme('night', true)).toBe('night');
      expect(getOppositeTheme('none', false)).toBe('none');
      expect(getOppositeTheme('vue', false)).toBe('vue');
    });

    it('returns same theme when targetIsLight matches current theme', () => {
      // Already light, target is light - no change
      expect(getOppositeTheme('github-light', true)).toBe('github-light');
      // Already dark, target is dark - no change
      expect(getOppositeTheme('github-dark', false)).toBe('github-dark');
    });
  });

  describe('PREVIEW_THEMES constant', () => {
    it('contains 16 themes', () => {
      expect(PREVIEW_THEMES).toHaveLength(16);
    });

    it('includes all expected theme names', () => {
      const expectedThemes: PreviewTheme[] = [
        'github-light',
        'github-dark',
        'atom-dark',
        'atom-light',
        'atom-material',
        'one-dark',
        'one-light',
        'solarized-dark',
        'solarized-light',
        'gothic',
        'medium',
        'monokai',
        'newsprint',
        'night',
        'none',
        'vue',
      ];

      expectedThemes.forEach((theme) => {
        expect(PREVIEW_THEMES).toContain(theme);
      });
    });

    it('is an array', () => {
      expect(Array.isArray(PREVIEW_THEMES)).toBe(true);
    });
  });

  describe('CODE_BLOCK_THEMES constant', () => {
    it('contains 24 themes', () => {
      expect(CODE_BLOCK_THEMES).toHaveLength(24);
    });

    it('includes auto option', () => {
      expect(CODE_BLOCK_THEMES).toContain('auto');
    });

    it('includes default option', () => {
      expect(CODE_BLOCK_THEMES).toContain('default');
    });

    it('includes common code block themes', () => {
      const expectedThemes = [
        'monokai',
        'github',
        'github-dark',
        'vs',
        'okaidia',
        'dark',
        'twilight',
      ];

      expectedThemes.forEach((theme) => {
        expect(CODE_BLOCK_THEMES).toContain(theme);
      });
    });
  });

  describe('THEME_PAIRS constant', () => {
    it('contains github, atom, one, solarized pairs', () => {
      expect(THEME_PAIRS).toHaveProperty('github');
      expect(THEME_PAIRS).toHaveProperty('atom');
      expect(THEME_PAIRS).toHaveProperty('one');
      expect(THEME_PAIRS).toHaveProperty('solarized');
    });

    it('each pair has light and dark properties', () => {
      Object.values(THEME_PAIRS).forEach((pair) => {
        expect(pair).toHaveProperty('light');
        expect(pair).toHaveProperty('dark');
      });
    });

    it('github pair has correct themes', () => {
      expect(THEME_PAIRS.github.light).toBe('github-light');
      expect(THEME_PAIRS.github.dark).toBe('github-dark');
    });

    it('atom pair has correct themes', () => {
      expect(THEME_PAIRS.atom.light).toBe('atom-light');
      expect(THEME_PAIRS.atom.dark).toBe('atom-dark');
    });

    it('one pair has correct themes', () => {
      expect(THEME_PAIRS.one.light).toBe('one-light');
      expect(THEME_PAIRS.one.dark).toBe('one-dark');
    });

    it('solarized pair has correct themes', () => {
      expect(THEME_PAIRS.solarized.light).toBe('solarized-light');
      expect(THEME_PAIRS.solarized.dark).toBe('solarized-dark');
    });
  });

  describe('type interfaces', () => {
    it('FetchResult interface has expected shape', () => {
      const fetchResult: FetchResult = {
        fsPath: '/path/to/module.js',
        code: 'export default {};',
        dependencies: ['dep1', 'dep2'],
        css: '.class { color: red; }',
      };

      expect(fetchResult.fsPath).toBeDefined();
      expect(fetchResult.code).toBeDefined();
      expect(fetchResult.dependencies).toBeInstanceOf(Array);
      // CSS is optional
    });

    it('TrustState interface has expected shape', () => {
      const trustState: TrustState = {
        workspaceTrusted: true,
        scriptsEnabled: true,
        canExecute: true,
        reason: 'Workspace is trusted',
        openMdxLinksInPreview: true,
      };

      expect(trustState.workspaceTrusted).toBeDefined();
      expect(trustState.scriptsEnabled).toBeDefined();
      expect(trustState.canExecute).toBeDefined();
      // reason is optional
    });

    it('WebviewThemeState interface has expected shape', () => {
      const themeState: WebviewThemeState = {
        previewTheme: 'github-light',
        codeBlockTheme: 'auto',
        isLight: true,
      };

      expect(themeState.previewTheme).toBeDefined();
      expect(themeState.codeBlockTheme).toBeDefined();
      expect(themeState.isLight).toBeDefined();
    });

    it('PreviewError interface has expected shape', () => {
      const error: PreviewError = {
        message: 'Error message',
        stack: 'Error stack trace',
        code: 'ERROR_CODE',
      };

      expect(error.message).toBeDefined();
      // stack & code are optional
    });
  });
});
