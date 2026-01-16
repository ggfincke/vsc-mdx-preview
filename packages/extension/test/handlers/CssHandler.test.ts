// packages/extension/test/handlers/CssHandler.test.ts
// tests for CssHandler - returns CSS for webview injection

import { describe, it, expect } from 'vitest';
import { CssHandler } from '../../module-fetcher/handlers/CssHandler';
import type { Preview } from '../../preview/preview-manager';

describe('CssHandler', () => {
  const handler = new CssHandler();
  const mockPreview = {} as Preview;

  describe('extensions', () => {
    it('handles .css files', () => {
      expect(handler.extensions).toContain('.css');
    });

    it('only handles .css extension', () => {
      expect(handler.extensions).toHaveLength(1);
    });
  });

  describe('handle', () => {
    it('returns CSS in css field', async () => {
      const css = '.button { color: red; }';
      const result = await handler.handle(
        css,
        '/path/to/styles.css',
        mockPreview
      );

      expect(result.css).toBe(css);
    });

    it('returns empty string for code field', async () => {
      const css = '.test { display: block; }';
      const result = await handler.handle(
        css,
        '/path/to/styles.css',
        mockPreview
      );

      expect(result.code).toBe('');
    });

    it('returns empty dependencies array', async () => {
      const css = '.test { color: blue; }';
      const result = await handler.handle(
        css,
        '/path/to/styles.css',
        mockPreview
      );

      expect(result.dependencies).toEqual([]);
    });

    it('preserves fsPath in result', async () => {
      const fsPath = '/workspace/src/components/Button.css';
      const result = await handler.handle('.btn {}', fsPath, mockPreview);

      expect(result.fsPath).toBe(fsPath);
    });

    it('handles CSS with @import statements', async () => {
      const css = '@import url("other.css");\n.test { color: red; }';
      const result = await handler.handle(
        css,
        '/path/to/styles.css',
        mockPreview
      );

      expect(result.css).toBe(css);
      // Note: CSS @imports are not parsed as dependencies - they're handled by the browser
      expect(result.dependencies).toEqual([]);
    });

    it('handles CSS with media queries', async () => {
      const css = '@media (max-width: 600px) { .mobile { display: block; } }';
      const result = await handler.handle(
        css,
        '/path/to/responsive.css',
        mockPreview
      );

      expect(result.css).toBe(css);
    });

    it('handles CSS with keyframes', async () => {
      const css = '@keyframes fade { from { opacity: 0; } to { opacity: 1; } }';
      const result = await handler.handle(
        css,
        '/path/to/animations.css',
        mockPreview
      );

      expect(result.css).toBe(css);
    });

    it('handles CSS with variables', async () => {
      const css =
        ':root { --primary: #007bff; } .btn { color: var(--primary); }';
      const result = await handler.handle(
        css,
        '/path/to/variables.css',
        mockPreview
      );

      expect(result.css).toBe(css);
    });

    it('handles empty CSS string', async () => {
      const result = await handler.handle(
        '',
        '/path/to/empty.css',
        mockPreview
      );

      expect(result.css).toBe('');
      expect(result.code).toBe('');
    });

    it('handles CSS with special characters and unicode', async () => {
      const css = '.icon::before { content: "\\2714"; }';
      const result = await handler.handle(
        css,
        '/path/to/icons.css',
        mockPreview
      );

      expect(result.css).toBe(css);
    });

    it('handles large CSS content', async () => {
      const largeCss = '.class { color: red; }\n'.repeat(1000);
      const result = await handler.handle(
        largeCss,
        '/path/to/large.css',
        mockPreview
      );

      expect(result.css).toBe(largeCss);
      expect(result.css.length).toBeGreaterThan(20000);
    });
  });
});
