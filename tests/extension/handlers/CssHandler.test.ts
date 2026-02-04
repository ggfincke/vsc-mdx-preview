// tests/extension/handlers/CssHandler.test.ts
// unit tests for CSS file handler

import { describe, it, expect, vi } from 'vitest';
import { CssHandler } from '../../../packages/extension/module-system/handlers/CssHandler';
import type { Preview } from '../../../packages/extension/preview/preview-manager';

// minimal Preview mock for handler
const mockPreview = {} as Preview;

describe('CssHandler', () => {
  const handler = new CssHandler();

  describe('extensions', () => {
    it('should handle .css extension', () => {
      expect(handler.extensions).toContain('.css');
    });
  });

  describe('Basic CSS Processing', () => {
    it('should return FetchResult w/ css field containing file content', async () => {
      const css = '.button { padding: 10px; color: blue; }';
      const fsPath = '/path/to/styles.css';

      const result = await handler.handle(css, fsPath, mockPreview);

      expect(result.css).toBe(css);
      expect(result.fsPath).toBe(fsPath);
    });

    it('should return empty code field', async () => {
      const css = '.test { }';
      const result = await handler.handle(css, '/path/to/test.css', mockPreview);

      expect(result.code).toBe('');
    });

    it('should return empty dependencies array', async () => {
      const css = '.test { }';
      const result = await handler.handle(css, '/path/to/test.css', mockPreview);

      expect(result.dependencies).toEqual([]);
    });

    it('should preserve file path in result', async () => {
      const fsPath = '/workspace/src/styles/main.css';
      const result = await handler.handle('.test { }', fsPath, mockPreview);

      expect(result.fsPath).toBe(fsPath);
    });
  });

  describe('CSS w/ Imports', () => {
    it('should return CSS w/ @import statements unchanged', async () => {
      const css = `
        @import url('./reset.css');
        @import "./theme.css";

        .main { color: red; }
      `;

      const result = await handler.handle(css, '/path/to/main.css', mockPreview);

      expect(result.css).toBe(css);
    });

    it('should not extract @import dependencies (browser handles)', async () => {
      const css = `
        @import url('./a.css');
        @import "./b.css";
      `;

      const result = await handler.handle(css, '/path/to/main.css', mockPreview);

      // dependencies not extracted in current implementation
      expect(result.dependencies).toEqual([]);
    });
  });

  describe('Malformed CSS', () => {
    it('should not throw on invalid CSS syntax', async () => {
      const invalidCss = `
        .broken { color: ; }
        .incomplete {
        .missing-semicolon { color: red }
      `;

      await expect(
        handler.handle(invalidCss, '/path/to/broken.css', mockPreview)
      ).resolves.toBeDefined();
    });

    it('should return invalid CSS as-is (browser handles errors)', async () => {
      const invalidCss = '.invalid { color: ; }';

      const result = await handler.handle(invalidCss, '/path/to/test.css', mockPreview);

      expect(result.css).toBe(invalidCss);
    });

    it('should handle CSS w/ syntax errors in @rules', async () => {
      const css = `
        @media screen and {
          .test { color: red; }
        }
      `;

      const result = await handler.handle(css, '/path/to/test.css', mockPreview);

      expect(result.css).toBe(css);
    });
  });

  describe('File Path Handling', () => {
    it('should handle absolute paths', async () => {
      const fsPath = '/absolute/path/to/styles.css';
      const result = await handler.handle('.test { }', fsPath, mockPreview);

      expect(result.fsPath).toBe(fsPath);
    });

    it('should handle paths w/ special characters', async () => {
      const fsPath = '/path/to/my-styles_v2.0.css';
      const result = await handler.handle('.test { }', fsPath, mockPreview);

      expect(result.fsPath).toBe(fsPath);
    });

    it('should handle paths w/ spaces', async () => {
      const fsPath = '/path/to/my styles/main.css';
      const result = await handler.handle('.test { }', fsPath, mockPreview);

      expect(result.fsPath).toBe(fsPath);
    });

    it('should handle Windows-style paths', async () => {
      const fsPath = 'C:\\Users\\test\\styles.css';
      const result = await handler.handle('.test { }', fsPath, mockPreview);

      expect(result.fsPath).toBe(fsPath);
    });
  });

  describe('Empty Files', () => {
    it('should handle empty CSS file', async () => {
      const result = await handler.handle('', '/path/to/empty.css', mockPreview);

      expect(result.css).toBe('');
      expect(result.code).toBe('');
      expect(result.dependencies).toEqual([]);
    });

    it('should not throw on empty content', async () => {
      await expect(
        handler.handle('', '/path/to/empty.css', mockPreview)
      ).resolves.toBeDefined();
    });
  });

  describe('Large Files', () => {
    it('should handle large CSS content', async () => {
      // generate 100KB of CSS
      const largeRule = '.large-rule { padding: 10px; margin: 5px; }\n';
      const largeCss = largeRule.repeat(100000 / largeRule.length);

      const result = await handler.handle(largeCss, '/path/to/large.css', mockPreview);

      expect(result.css).toBe(largeCss);
      expect(result.css.length).toBeGreaterThan(50000);
    });
  });

  describe('Special CSS Features', () => {
    it('should handle CSS custom properties', async () => {
      const css = `
        :root {
          --primary-color: blue;
          --spacing: 10px;
        }
        .test { color: var(--primary-color); }
      `;

      const result = await handler.handle(css, '/path/to/vars.css', mockPreview);

      expect(result.css).toBe(css);
    });

    it('should handle CSS grid & flexbox', async () => {
      const css = `
        .grid { display: grid; grid-template-columns: 1fr 1fr; }
        .flex { display: flex; justify-content: center; }
      `;

      const result = await handler.handle(css, '/path/to/layout.css', mockPreview);

      expect(result.css).toBe(css);
    });

    it('should handle media queries', async () => {
      const css = `
        @media (max-width: 768px) {
          .mobile { display: block; }
        }
        @media (prefers-color-scheme: dark) {
          .dark { background: black; }
        }
      `;

      const result = await handler.handle(css, '/path/to/responsive.css', mockPreview);

      expect(result.css).toBe(css);
    });

    it('should handle keyframe animations', async () => {
      const css = `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .fade { animation: fadeIn 1s; }
      `;

      const result = await handler.handle(css, '/path/to/animations.css', mockPreview);

      expect(result.css).toBe(css);
    });

    it('should handle CSS nesting (future syntax)', async () => {
      const css = `
        .parent {
          color: blue;
          & .child { color: red; }
        }
      `;

      const result = await handler.handle(css, '/path/to/nested.css', mockPreview);

      expect(result.css).toBe(css);
    });

    it('should handle @supports queries', async () => {
      const css = `
        @supports (display: grid) {
          .grid { display: grid; }
        }
      `;

      const result = await handler.handle(css, '/path/to/supports.css', mockPreview);

      expect(result.css).toBe(css);
    });
  });

  describe('Unicode & Encoding', () => {
    it('should handle CSS w/ unicode characters', async () => {
      const css = `
        .emoji::before { content: "🎨"; }
        .chinese { font-family: "微软雅黑"; }
      `;

      const result = await handler.handle(css, '/path/to/unicode.css', mockPreview);

      expect(result.css).toBe(css);
    });

    it('should handle CSS w/ escaped unicode', async () => {
      const css = '.test { content: "\\00A0"; }';

      const result = await handler.handle(css, '/path/to/escaped.css', mockPreview);

      expect(result.css).toBe(css);
    });
  });

  describe('Comments', () => {
    it('should preserve CSS comments', async () => {
      const css = `
        /* Main styles */
        .test { color: red; }
        /* TODO: refactor */
        .todo { /* inline comment */ color: blue; }
      `;

      const result = await handler.handle(css, '/path/to/comments.css', mockPreview);

      expect(result.css).toBe(css);
    });

    it('should handle comment-only CSS file', async () => {
      const css = '/* This file only contains comments */';

      const result = await handler.handle(css, '/path/to/comments-only.css', mockPreview);

      expect(result.css).toBe(css);
    });
  });

  describe('Result Structure', () => {
    it('should return all required FetchResult fields', async () => {
      const result = await handler.handle('.test { }', '/path/to/test.css', mockPreview);

      expect(result).toHaveProperty('fsPath');
      expect(result).toHaveProperty('css');
      expect(result).toHaveProperty('code');
      expect(result).toHaveProperty('dependencies');
    });

    it('should not include undefined fields', async () => {
      const result = await handler.handle('.test { }', '/path/to/test.css', mockPreview);

      expect(Object.values(result).every((v) => v !== undefined)).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should handle CSS quickly (< 10ms for typical file)', async () => {
      const css = '.test { color: red; }'.repeat(100);

      const start = Date.now();
      await handler.handle(css, '/path/to/test.css', mockPreview);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(10);
    });
  });
});
