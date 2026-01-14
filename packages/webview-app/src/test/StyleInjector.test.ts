// packages/webview-app/src/test/StyleInjector.test.ts
// unit tests for StyleInjector (CSS injection, deduplication, removal)

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StyleInjector, STYLE_IDS } from '../utils/StyleInjector';

describe('StyleInjector', () => {
  beforeEach(() => {
    // Clear tracking state before each test
    StyleInjector.clearTracking();
    // Clear any existing style elements
    document.head.innerHTML = '';
    // Reset document element attributes
    Array.from(document.documentElement.attributes)
      .filter((attr) => attr.name.startsWith('data-'))
      .forEach((attr) => document.documentElement.removeAttribute(attr.name));
  });

  afterEach(() => {
    // Clean up after each test
    StyleInjector.clearTracking();
    document.head.innerHTML = '';
  });

  describe('STYLE_IDS', () => {
    it('exports expected style IDs', () => {
      expect(STYLE_IDS.PREVIEW_THEME).toBe('mpe-preview-theme');
      expect(STYLE_IDS.CODE_BLOCK_THEME).toBe('mpe-code-block-theme');
      expect(STYLE_IDS.CUSTOM_CSS).toBe('mdx-preview-custom-css');
      expect(STYLE_IDS.TAILWIND_CSS).toBe('mdx-preview-tailwind-css');
    });
  });

  describe('inject', () => {
    it('creates a style element with the given ID', () => {
      StyleInjector.inject('test-style', '.test { color: red; }');

      const styleEl = document.getElementById('test-style');
      expect(styleEl).not.toBeNull();
      expect(styleEl?.tagName).toBe('STYLE');
      expect(styleEl?.textContent).toBe('.test { color: red; }');
    });

    it('appends style to document.head', () => {
      StyleInjector.inject('test-style', '.test { color: blue; }');

      expect(document.head.children.length).toBe(1);
      expect(document.head.children[0].id).toBe('test-style');
    });

    it('updates existing style element with same ID', () => {
      StyleInjector.inject('test-style', '.old { color: red; }');
      StyleInjector.inject('test-style', '.new { color: blue; }');

      expect(document.head.children.length).toBe(1);
      const styleEl = document.getElementById('test-style');
      expect(styleEl?.textContent).toBe('.new { color: blue; }');
    });

    it('respects deduplicate option - skips if already injected', () => {
      StyleInjector.inject('dedup-style', '.first { color: red; }', {
        deduplicate: true,
      });
      StyleInjector.inject('dedup-style', '.second { color: blue; }', {
        deduplicate: true,
      });

      const styleEl = document.getElementById('dedup-style');
      // Should still have first content due to deduplication
      expect(styleEl?.textContent).toBe('.first { color: red; }');
    });

    it('without deduplicate option - always updates', () => {
      StyleInjector.inject('no-dedup-style', '.first { color: red; }');
      StyleInjector.inject('no-dedup-style', '.second { color: blue; }');

      const styleEl = document.getElementById('no-dedup-style');
      expect(styleEl?.textContent).toBe('.second { color: blue; }');
    });

    it('inserts before specified element when insertBefore is set', () => {
      // Create an existing element to insert before
      const existingStyle = document.createElement('style');
      existingStyle.id = 'existing-style';
      document.head.appendChild(existingStyle);

      StyleInjector.inject('new-style', '.test {}', {
        insertBefore: 'existing-style',
      });

      const children = Array.from(document.head.children);
      expect(children[0].id).toBe('new-style');
      expect(children[1].id).toBe('existing-style');
    });

    it('appends to head if insertBefore element not found', () => {
      StyleInjector.inject('new-style', '.test {}', {
        insertBefore: 'non-existent',
      });

      expect(document.head.children.length).toBe(1);
      expect(document.head.children[0].id).toBe('new-style');
    });

    it('sets data attribute on document element when specified', () => {
      StyleInjector.inject('theme-style', '.theme {}', {
        dataAttribute: { name: 'data-theme', value: 'dark' },
      });

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
  });

  describe('injectModuleCss', () => {
    it('creates style element with data-module-id attribute', () => {
      StyleInjector.injectModuleCss('/path/to/module.css', '.module { color: red; }');

      const styles = document.querySelectorAll('style[data-module-id]');
      expect(styles.length).toBe(1);
      expect(styles[0].getAttribute('data-module-id')).toBe('/path/to/module.css');
      expect(styles[0].textContent).toBe('.module { color: red; }');
    });

    it('does not inject same module CSS twice', () => {
      StyleInjector.injectModuleCss('/module.css', '.first {}');
      StyleInjector.injectModuleCss('/module.css', '.second {}');

      const styles = document.querySelectorAll('style[data-module-id]');
      expect(styles.length).toBe(1);
      expect(styles[0].textContent).toBe('.first {}');
    });

    it('injects different modules separately', () => {
      StyleInjector.injectModuleCss('/module1.css', '.one {}');
      StyleInjector.injectModuleCss('/module2.css', '.two {}');

      const styles = document.querySelectorAll('style[data-module-id]');
      expect(styles.length).toBe(2);
    });
  });

  describe('remove', () => {
    it('removes style element by ID', () => {
      StyleInjector.inject('to-remove', '.test {}');
      expect(document.getElementById('to-remove')).not.toBeNull();

      StyleInjector.remove('to-remove');
      expect(document.getElementById('to-remove')).toBeNull();
    });

    it('clears tracking for removed style', () => {
      StyleInjector.inject('to-remove', '.test {}', { deduplicate: true });
      expect(StyleInjector.hasInjected('to-remove')).toBe(true);

      StyleInjector.remove('to-remove');
      expect(StyleInjector.hasInjected('to-remove')).toBe(false);
    });

    it('does nothing if element does not exist', () => {
      // Should not throw
      StyleInjector.remove('non-existent');
    });
  });

  describe('removeDataAttribute', () => {
    it('removes data attribute from document element', () => {
      document.documentElement.setAttribute('data-test', 'value');
      expect(document.documentElement.getAttribute('data-test')).toBe('value');

      StyleInjector.removeDataAttribute('data-test');
      expect(document.documentElement.getAttribute('data-test')).toBeNull();
    });

    it('does nothing if attribute does not exist', () => {
      // Should not throw
      StyleInjector.removeDataAttribute('non-existent');
    });
  });

  describe('clear', () => {
    it('clears all module styles when selector is "modules"', () => {
      StyleInjector.injectModuleCss('/mod1.css', '.one {}');
      StyleInjector.injectModuleCss('/mod2.css', '.two {}');
      StyleInjector.inject('non-module', '.three {}');

      expect(document.querySelectorAll('style[data-module-id]').length).toBe(2);

      StyleInjector.clear('modules');

      expect(document.querySelectorAll('style[data-module-id]').length).toBe(0);
      expect(document.getElementById('non-module')).not.toBeNull();
    });

    it('clears styles by custom selector', () => {
      StyleInjector.inject('style-a', '.a {}');
      StyleInjector.inject('style-b', '.b {}');

      StyleInjector.clear('#style-a');

      expect(document.getElementById('style-a')).toBeNull();
      expect(document.getElementById('style-b')).not.toBeNull();
    });

    it('clears tracking for removed styles', () => {
      StyleInjector.injectModuleCss('/mod.css', '.test {}');
      expect(StyleInjector.hasInjected('/mod.css')).toBe(true);

      StyleInjector.clear('modules');
      expect(StyleInjector.hasInjected('/mod.css')).toBe(false);
    });
  });

  describe('clearTracking', () => {
    it('clears all tracking without removing style elements', () => {
      StyleInjector.inject('style-1', '.test {}', { deduplicate: true });
      StyleInjector.injectModuleCss('/mod.css', '.mod {}');

      expect(StyleInjector.hasInjected('style-1')).toBe(true);
      expect(StyleInjector.hasInjected('/mod.css')).toBe(true);

      StyleInjector.clearTracking();

      expect(StyleInjector.hasInjected('style-1')).toBe(false);
      expect(StyleInjector.hasInjected('/mod.css')).toBe(false);
      // Style elements should still exist
      expect(document.getElementById('style-1')).not.toBeNull();
    });
  });

  describe('hasInjected', () => {
    it('returns true if style was injected with deduplicate', () => {
      StyleInjector.inject('test', '.test {}', { deduplicate: true });
      expect(StyleInjector.hasInjected('test')).toBe(true);
    });

    it('returns false if style was injected without deduplicate', () => {
      StyleInjector.inject('test', '.test {}');
      expect(StyleInjector.hasInjected('test')).toBe(false);
    });

    it('returns true for module CSS', () => {
      StyleInjector.injectModuleCss('/mod.css', '.test {}');
      expect(StyleInjector.hasInjected('/mod.css')).toBe(true);
    });

    it('returns false for unknown ID', () => {
      expect(StyleInjector.hasInjected('unknown')).toBe(false);
    });
  });

  describe('markInjected', () => {
    it('marks a style as injected for external tracking', () => {
      expect(StyleInjector.hasInjected('external')).toBe(false);

      StyleInjector.markInjected('external');

      expect(StyleInjector.hasInjected('external')).toBe(true);
    });
  });

  describe('integration scenarios', () => {
    it('handles theme CSS injection pattern', () => {
      // simulate theme injection w/ data attribute
      StyleInjector.inject(
        STYLE_IDS.PREVIEW_THEME,
        ':root { --color: #fff; }',
        {
          dataAttribute: { name: 'data-color-scheme', value: 'light' },
        }
      );

      const themeEl = document.getElementById(STYLE_IDS.PREVIEW_THEME);
      expect(themeEl?.textContent).toContain('--color');
      expect(document.documentElement.getAttribute('data-color-scheme')).toBe(
        'light'
      );
    });

    it('handles Tailwind CSS insertion order', () => {
      // Custom CSS should come after Tailwind
      StyleInjector.inject(STYLE_IDS.CUSTOM_CSS, '.custom {}');
      StyleInjector.inject(STYLE_IDS.TAILWIND_CSS, '@tailwind base;', {
        insertBefore: STYLE_IDS.CUSTOM_CSS,
      });

      const children = Array.from(document.head.children);
      const tailwindIndex = children.findIndex(
        (c) => c.id === STYLE_IDS.TAILWIND_CSS
      );
      const customIndex = children.findIndex(
        (c) => c.id === STYLE_IDS.CUSTOM_CSS
      );

      expect(tailwindIndex).toBeLessThan(customIndex);
    });
  });
});
