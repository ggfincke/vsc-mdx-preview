// packages/webview-app/src/test/security/allowlist.test.ts
// tests for DOMPurify allowlist configuration

import { describe, it, expect } from 'vitest';
import { DOMPURIFY_CONFIG } from '../../security/allowlist';

describe('DOMPURIFY_CONFIG', () => {
  describe('structure', () => {
    it('has ALLOWED_TAGS array', () => {
      expect(DOMPURIFY_CONFIG.ALLOWED_TAGS).toBeDefined();
      expect(Array.isArray(DOMPURIFY_CONFIG.ALLOWED_TAGS)).toBe(true);
    });

    it('has ALLOWED_ATTR array', () => {
      expect(DOMPURIFY_CONFIG.ALLOWED_ATTR).toBeDefined();
      expect(Array.isArray(DOMPURIFY_CONFIG.ALLOWED_ATTR)).toBe(true);
    });

    it('has ALLOWED_URI_REGEXP', () => {
      expect(DOMPURIFY_CONFIG.ALLOWED_URI_REGEXP).toBeDefined();
      expect(DOMPURIFY_CONFIG.ALLOWED_URI_REGEXP).toBeInstanceOf(RegExp);
    });

    it('disallows unknown protocols', () => {
      expect(DOMPURIFY_CONFIG.ALLOW_UNKNOWN_PROTOCOLS).toBe(false);
    });
  });

  describe('ALLOWED_TAGS', () => {
    const tags = DOMPURIFY_CONFIG.ALLOWED_TAGS as string[];

    describe('heading elements', () => {
      it.each(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])('includes %s', (tag) => {
        expect(tags).toContain(tag);
      });
    });

    describe('text content elements', () => {
      it.each(['p', 'span', 'div', 'br', 'hr'])('includes %s', (tag) => {
        expect(tags).toContain(tag);
      });
    });

    describe('list elements', () => {
      it.each(['ul', 'ol', 'li'])('includes %s', (tag) => {
        expect(tags).toContain(tag);
      });
    });

    describe('text formatting elements', () => {
      it.each([
        'strong',
        'b',
        'em',
        'i',
        'u',
        's',
        'strike',
        'del',
        'ins',
        'mark',
        'sub',
        'sup',
        'small',
      ])('includes %s', (tag) => {
        expect(tags).toContain(tag);
      });
    });

    describe('code elements', () => {
      it.each(['pre', 'code', 'kbd', 'samp', 'var'])('includes %s', (tag) => {
        expect(tags).toContain(tag);
      });
    });

    describe('link and media elements', () => {
      it.each(['a', 'img'])('includes %s', (tag) => {
        expect(tags).toContain(tag);
      });
    });

    describe('table elements', () => {
      it.each([
        'table',
        'thead',
        'tbody',
        'tfoot',
        'tr',
        'th',
        'td',
        'caption',
        'colgroup',
        'col',
      ])('includes %s', (tag) => {
        expect(tags).toContain(tag);
      });
    });

    describe('KaTeX math elements', () => {
      it.each([
        'math',
        'semantics',
        'mrow',
        'mi',
        'mo',
        'mn',
        'msup',
        'msub',
        'msubsup',
        'mfrac',
        'mover',
        'munder',
        'munderover',
        'mtable',
        'mtr',
        'mtd',
        'msqrt',
        'mroot',
        'mtext',
        'mspace',
        'annotation',
      ])('includes %s', (tag) => {
        expect(tags).toContain(tag);
      });
    });

    describe('SVG elements for Mermaid', () => {
      it.each([
        'svg',
        'g',
        'path',
        'rect',
        'circle',
        'ellipse',
        'line',
        'polyline',
        'polygon',
        'text',
        'tspan',
        'defs',
        'clipPath',
        'marker',
        'use',
        'linearGradient',
        'radialGradient',
        'stop',
      ])('includes %s', (tag) => {
        expect(tags).toContain(tag);
      });
    });

    describe('security - excluded tags', () => {
      it.each([
        'script',
        'style',
        'iframe',
        'object',
        'embed',
        'form',
        'input',
        'button',
        'link',
        'meta',
        'base',
      ])('does NOT include %s', (tag) => {
        expect(tags).not.toContain(tag);
      });

      it('does NOT include foreignObject (SVG XSS vector)', () => {
        expect(tags).not.toContain('foreignObject');
      });
    });
  });

  describe('ALLOWED_ATTR', () => {
    const attrs = DOMPURIFY_CONFIG.ALLOWED_ATTR as string[];

    describe('common attributes', () => {
      it.each([
        'href',
        'src',
        'alt',
        'title',
        'class',
        'id',
        'name',
        'target',
        'rel',
      ])('includes %s', (attr) => {
        expect(attrs).toContain(attr);
      });
    });

    describe('dimension attributes', () => {
      it.each(['width', 'height', 'colspan', 'rowspan'])(
        'includes %s',
        (attr) => {
          expect(attrs).toContain(attr);
        }
      );
    });

    describe('KaTeX math attributes', () => {
      it.each([
        'mathvariant',
        'encoding',
        'stretchy',
        'fence',
        'lspace',
        'rspace',
        'columnalign',
        'rowalign',
        'displaystyle',
        'scriptlevel',
        'xmlns',
      ])('includes %s', (attr) => {
        expect(attrs).toContain(attr);
      });
    });

    describe('SVG attributes for Mermaid', () => {
      it.each([
        'd',
        'fill',
        'stroke',
        'stroke-width',
        'transform',
        'viewBox',
        'x',
        'y',
        'x1',
        'y1',
        'x2',
        'y2',
        'cx',
        'cy',
        'r',
        'rx',
        'ry',
        'text-anchor',
        'font-size',
        'opacity',
      ])('includes %s', (attr) => {
        expect(attrs).toContain(attr);
      });
    });

    describe('data attributes', () => {
      it('includes data-mermaid-chart', () => {
        expect(attrs).toContain('data-mermaid-chart');
      });

      it('includes data-mermaid-id', () => {
        expect(attrs).toContain('data-mermaid-id');
      });

      it('includes data-admonition-type', () => {
        expect(attrs).toContain('data-admonition-type');
      });
    });

    describe('style attribute', () => {
      it('includes style (needed for KaTeX)', () => {
        expect(attrs).toContain('style');
      });
    });

    describe('security - excluded attributes', () => {
      it.each([
        'onclick',
        'onerror',
        'onload',
        'onmouseover',
        'onfocus',
        'onblur',
      ])('does NOT include event handler %s', (attr) => {
        expect(attrs).not.toContain(attr);
      });
    });
  });

  describe('ALLOWED_URI_REGEXP', () => {
    const regex = DOMPURIFY_CONFIG.ALLOWED_URI_REGEXP as RegExp;

    describe('allowed protocols', () => {
      it('allows https:// URLs', () => {
        expect(regex.test('https://example.com')).toBe(true);
      });

      it('allows http:// URLs', () => {
        expect(regex.test('http://example.com')).toBe(true);
      });

      it('allows mailto: URLs', () => {
        expect(regex.test('mailto:test@example.com')).toBe(true);
      });

      it('allows tel: URLs', () => {
        expect(regex.test('tel:+1234567890')).toBe(true);
      });

      it('allows fragment-only URLs (#section)', () => {
        expect(regex.test('#section')).toBe(true);
      });

      it('allows relative URLs', () => {
        expect(regex.test('/path/to/page')).toBe(true);
        expect(regex.test('./relative/path')).toBe(true);
        expect(regex.test('../parent/path')).toBe(true);
      });
    });

    describe('blocked protocols', () => {
      it('blocks javascript: URLs', () => {
        expect(regex.test('javascript:alert(1)')).toBe(false);
      });

      it('blocks vbscript: URLs', () => {
        expect(regex.test('vbscript:msgbox(1)')).toBe(false);
      });

      it('blocks data: URLs with script content', () => {
        // data: with text/html should be blocked
        expect(regex.test('data:text/html,<script>alert(1)</script>')).toBe(
          false
        );
      });
    });
  });

  describe('ADD_ATTR', () => {
    it('adds target attribute', () => {
      expect(DOMPURIFY_CONFIG.ADD_ATTR).toContain('target');
    });

    it('adds rel attribute', () => {
      expect(DOMPURIFY_CONFIG.ADD_ATTR).toContain('rel');
    });
  });
});
