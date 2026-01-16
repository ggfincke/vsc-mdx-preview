// packages/webview-app/src/test/security/safeModeStyles.test.ts
// tests for safe mode placeholder styles

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ensureSafeModeStyles } from '../../security/safeModeStyles';

describe('ensureSafeModeStyles', () => {
  const STYLE_ID = 'mdx-safe-mode-styles';

  beforeEach(() => {
    // Clean up any existing style element
    const existing = document.getElementById(STYLE_ID);
    if (existing) {
      existing.remove();
    }
  });

  afterEach(() => {
    // Clean up after each test
    const existing = document.getElementById(STYLE_ID);
    if (existing) {
      existing.remove();
    }
  });

  describe('style element creation', () => {
    it('creates style element on first call', () => {
      ensureSafeModeStyles();

      const style = document.getElementById(STYLE_ID);
      expect(style).not.toBeNull();
      expect(style?.tagName.toLowerCase()).toBe('style');
    });

    it('does not duplicate on second call', () => {
      ensureSafeModeStyles();
      ensureSafeModeStyles();

      const styles = document.querySelectorAll(`#${STYLE_ID}`);
      expect(styles.length).toBe(1);
    });

    it('style element has correct ID', () => {
      ensureSafeModeStyles();

      const style = document.getElementById(STYLE_ID);
      expect(style?.id).toBe(STYLE_ID);
    });

    it('appends style to document.head', () => {
      ensureSafeModeStyles();

      const style = document.getElementById(STYLE_ID);
      expect(style?.parentElement).toBe(document.head);
    });
  });

  describe('CSS content', () => {
    it('contains .mdx-jsx-placeholder class', () => {
      ensureSafeModeStyles();

      const style = document.getElementById(STYLE_ID);
      expect(style?.textContent).toContain('.mdx-jsx-placeholder');
    });

    it('contains .mdx-expression-placeholder class', () => {
      ensureSafeModeStyles();

      const style = document.getElementById(STYLE_ID);
      expect(style?.textContent).toContain('.mdx-expression-placeholder');
    });

    it('contains .mdx-safe-preview class', () => {
      ensureSafeModeStyles();

      const style = document.getElementById(STYLE_ID);
      expect(style?.textContent).toContain('.mdx-safe-preview');
    });

    it('uses VSCode CSS variables', () => {
      ensureSafeModeStyles();

      const style = document.getElementById(STYLE_ID);
      expect(style?.textContent).toContain(
        '--vscode-textBlockQuote-background'
      );
      expect(style?.textContent).toContain('--vscode-textBlockQuote-border');
      expect(style?.textContent).toContain('--vscode-descriptionForeground');
      expect(style?.textContent).toContain('--vscode-editor-font-family');
    });

    it('has fallback colors', () => {
      ensureSafeModeStyles();

      const style = document.getElementById(STYLE_ID);
      // Check for rgba fallbacks
      expect(style?.textContent).toContain('rgba(127, 127, 127');
      // Check for hex fallback
      expect(style?.textContent).toContain('#717171');
    });

    it('sets dashed border style', () => {
      ensureSafeModeStyles();

      const style = document.getElementById(STYLE_ID);
      expect(style?.textContent).toContain('1px dashed');
    });

    it('sets inline-block display', () => {
      ensureSafeModeStyles();

      const style = document.getElementById(STYLE_ID);
      expect(style?.textContent).toContain('display: inline-block');
    });

    it('sets cursor to help', () => {
      ensureSafeModeStyles();

      const style = document.getElementById(STYLE_ID);
      expect(style?.textContent).toContain('cursor: help');
    });

    it('sets border-radius', () => {
      ensureSafeModeStyles();

      const style = document.getElementById(STYLE_ID);
      expect(style?.textContent).toContain('border-radius: 3px');
    });

    it('sets padding', () => {
      ensureSafeModeStyles();

      const style = document.getElementById(STYLE_ID);
      expect(style?.textContent).toContain('padding: 2px 6px');
    });

    it('sets margin', () => {
      ensureSafeModeStyles();

      const style = document.getElementById(STYLE_ID);
      expect(style?.textContent).toContain('margin: 2px');
    });

    it('sets font-size', () => {
      ensureSafeModeStyles();

      const style = document.getElementById(STYLE_ID);
      expect(style?.textContent).toContain('font-size: 0.9em');
    });

    it('sets safe preview padding', () => {
      ensureSafeModeStyles();

      const style = document.getElementById(STYLE_ID);
      expect(style?.textContent).toContain('.mdx-safe-preview');
      expect(style?.textContent).toContain('padding: 16px');
    });
  });

  describe('idempotency', () => {
    it('is idempotent across multiple calls', () => {
      ensureSafeModeStyles();
      const firstContent = document.getElementById(STYLE_ID)?.textContent;

      ensureSafeModeStyles();
      ensureSafeModeStyles();
      ensureSafeModeStyles();

      const finalContent = document.getElementById(STYLE_ID)?.textContent;
      expect(finalContent).toBe(firstContent);
    });

    it('preserves existing style element', () => {
      ensureSafeModeStyles();
      const firstStyle = document.getElementById(STYLE_ID);

      ensureSafeModeStyles();
      const secondStyle = document.getElementById(STYLE_ID);

      expect(firstStyle).toBe(secondStyle);
    });
  });
});
