// tests for theme CSS loading & injection utilities

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  injectPreviewTheme,
  injectCodeBlockTheme,
  clearThemeStyles,
} from './loader';

// Mock the css module
vi.mock('./css', () => ({
  previewThemes: {
    'github-light': '.github-light { color: black; }',
    'github-dark': '.github-dark { color: white; }',
    none: '',
  },
  codeBlockThemes: {
    github: '.github { --shiki-color: #000; }',
    'github-dark': '.github-dark { --shiki-color: #fff; }',
    dracula: '.dracula { --shiki-color: #f8f8f2; }',
  },
}));

describe('injectPreviewTheme', () => {
  beforeEach(() => {
    // Clean up any existing style elements
    document.head.innerHTML = '';
    document.documentElement.removeAttribute('data-mpe-preview-theme');
  });

  afterEach(() => {
    document.head.innerHTML = '';
    document.documentElement.removeAttribute('data-mpe-preview-theme');
  });

  it('creates style element with theme CSS', () => {
    injectPreviewTheme('github-light');

    const styleEl = document.getElementById('mpe-preview-theme');
    expect(styleEl).toBeTruthy();
    expect(styleEl?.tagName).toBe('STYLE');
    expect(styleEl?.textContent).toBe('.github-light { color: black; }');
  });

  it('sets data attribute on document element', () => {
    injectPreviewTheme('github-dark');

    expect(
      document.documentElement.getAttribute('data-mpe-preview-theme')
    ).toBe('github-dark');
  });

  it('replaces existing style element content', () => {
    injectPreviewTheme('github-light');
    injectPreviewTheme('github-dark');

    const styleElements = document.querySelectorAll('#mpe-preview-theme');
    expect(styleElements.length).toBe(1);
    expect(styleElements[0].textContent).toBe('.github-dark { color: white; }');
  });

  it('handles theme with no CSS gracefully', () => {
    // 'none' theme has empty string CSS
    injectPreviewTheme('none');

    const styleEl = document.getElementById('mpe-preview-theme');
    expect(styleEl).toBeTruthy();
    // textContent should not be modified when css is falsy (empty string)
    // based on implementation: if (css) { styleEl.textContent = css; }
  });

  it('handles unknown theme gracefully', () => {
    // TypeScript would catch this, but test runtime behavior
    injectPreviewTheme('unknown-theme' as never);

    const styleEl = document.getElementById('mpe-preview-theme');
    expect(styleEl).toBeTruthy();
    // data attribute still set
    expect(
      document.documentElement.getAttribute('data-mpe-preview-theme')
    ).toBe('unknown-theme');
  });
});

describe('injectCodeBlockTheme', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.documentElement.removeAttribute('data-mpe-code-block-theme');
  });

  afterEach(() => {
    document.head.innerHTML = '';
    document.documentElement.removeAttribute('data-mpe-code-block-theme');
  });

  it('creates style element with theme CSS', () => {
    injectCodeBlockTheme('dracula', false);

    const styleEl = document.getElementById('mpe-code-block-theme');
    expect(styleEl).toBeTruthy();
    expect(styleEl?.tagName).toBe('STYLE');
    expect(styleEl?.textContent).toBe('.dracula { --shiki-color: #f8f8f2; }');
  });

  it('sets data attribute with effective theme', () => {
    injectCodeBlockTheme('github', true);

    expect(
      document.documentElement.getAttribute('data-mpe-code-block-theme')
    ).toBe('github');
  });

  it('replaces existing style element content', () => {
    injectCodeBlockTheme('github', true);
    injectCodeBlockTheme('dracula', false);

    const styleElements = document.querySelectorAll('#mpe-code-block-theme');
    expect(styleElements.length).toBe(1);
    expect(styleElements[0].textContent).toBe(
      '.dracula { --shiki-color: #f8f8f2; }'
    );
  });

  describe('auto mode', () => {
    it('selects github theme for light mode', () => {
      injectCodeBlockTheme('auto', true);

      const styleEl = document.getElementById('mpe-code-block-theme');
      expect(styleEl?.textContent).toBe('.github { --shiki-color: #000; }');
      expect(
        document.documentElement.getAttribute('data-mpe-code-block-theme')
      ).toBe('github');
    });

    it('selects github-dark theme for dark mode', () => {
      injectCodeBlockTheme('auto', false);

      const styleEl = document.getElementById('mpe-code-block-theme');
      expect(styleEl?.textContent).toBe(
        '.github-dark { --shiki-color: #fff; }'
      );
      expect(
        document.documentElement.getAttribute('data-mpe-code-block-theme')
      ).toBe('github-dark');
    });
  });

  it('handles unknown theme gracefully', () => {
    injectCodeBlockTheme('unknown-theme' as never, false);

    const styleEl = document.getElementById('mpe-code-block-theme');
    expect(styleEl).toBeTruthy();
    // textContent should be empty string for unknown theme
    expect(styleEl?.textContent).toBe('');
  });
});

describe('clearThemeStyles', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.documentElement.removeAttribute('data-mpe-preview-theme');
    document.documentElement.removeAttribute('data-mpe-code-block-theme');
  });

  afterEach(() => {
    document.head.innerHTML = '';
    document.documentElement.removeAttribute('data-mpe-preview-theme');
    document.documentElement.removeAttribute('data-mpe-code-block-theme');
  });

  it('removes preview theme style element', () => {
    injectPreviewTheme('github-light');
    expect(document.getElementById('mpe-preview-theme')).toBeTruthy();

    clearThemeStyles();

    expect(document.getElementById('mpe-preview-theme')).toBeNull();
  });

  it('removes code block theme style element', () => {
    injectCodeBlockTheme('dracula', false);
    expect(document.getElementById('mpe-code-block-theme')).toBeTruthy();

    clearThemeStyles();

    expect(document.getElementById('mpe-code-block-theme')).toBeNull();
  });

  it('removes both style elements', () => {
    injectPreviewTheme('github-light');
    injectCodeBlockTheme('dracula', false);

    clearThemeStyles();

    expect(document.getElementById('mpe-preview-theme')).toBeNull();
    expect(document.getElementById('mpe-code-block-theme')).toBeNull();
  });

  it('removes data attributes', () => {
    injectPreviewTheme('github-light');
    injectCodeBlockTheme('dracula', false);

    expect(
      document.documentElement.getAttribute('data-mpe-preview-theme')
    ).toBeTruthy();
    expect(
      document.documentElement.getAttribute('data-mpe-code-block-theme')
    ).toBeTruthy();

    clearThemeStyles();

    expect(
      document.documentElement.getAttribute('data-mpe-preview-theme')
    ).toBeNull();
    expect(
      document.documentElement.getAttribute('data-mpe-code-block-theme')
    ).toBeNull();
  });

  it('handles clearing when no styles exist', () => {
    // Should not throw
    expect(() => clearThemeStyles()).not.toThrow();
  });

  it('only removes theme style elements, not other styles', () => {
    // Add a non-theme style
    const otherStyle = document.createElement('style');
    otherStyle.id = 'other-styles';
    otherStyle.textContent = '.other { color: red; }';
    document.head.appendChild(otherStyle);

    injectPreviewTheme('github-light');

    clearThemeStyles();

    // Other styles should remain
    expect(document.getElementById('other-styles')).toBeTruthy();
    expect(document.getElementById('mpe-preview-theme')).toBeNull();
  });
});
