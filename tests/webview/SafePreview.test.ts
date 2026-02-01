// tests/webview/SafePreview.test.ts
// XSS prevention tests for Safe Mode DOMPurify configuration
//
// verify DOMPurify allowlist configuration used by SafePreview
// (test config itself since DOMPurify requires jsdom in non-browser environment)

import { describe, it, expect } from 'vitest';
import { DOMPURIFY_CONFIG } from '../../packages/webview-app/src/security/allowlist';

describe('DOMPurify Configuration', () => {
  describe('ALLOWED_TAGS', () => {
    const allowedTags = DOMPURIFY_CONFIG.ALLOWED_TAGS || [];

    it('allows safe structural elements', () => {
      const safeStructural = ['div', 'span', 'p', 'br', 'hr'];
      for (const tag of safeStructural) {
        expect(allowedTags).toContain(tag);
      }
    });

    it('allows heading elements', () => {
      for (let i = 1; i <= 6; i++) {
        expect(allowedTags).toContain(`h${i}`);
      }
    });

    it('allows list elements', () => {
      expect(allowedTags).toContain('ul');
      expect(allowedTags).toContain('ol');
      expect(allowedTags).toContain('li');
    });

    it('allows text formatting elements', () => {
      const formatting = [
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
      ];
      for (const tag of formatting) {
        expect(allowedTags).toContain(tag);
      }
    });

    it('allows code elements', () => {
      expect(allowedTags).toContain('pre');
      expect(allowedTags).toContain('code');
      expect(allowedTags).toContain('kbd');
      expect(allowedTags).toContain('samp');
      expect(allowedTags).toContain('var');
    });

    it('allows link and image elements', () => {
      expect(allowedTags).toContain('a');
      expect(allowedTags).toContain('img');
    });

    it('allows table elements', () => {
      const tableElements = [
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
      ];
      for (const tag of tableElements) {
        expect(allowedTags).toContain(tag);
      }
    });

    it('allows blockquote and citation elements', () => {
      expect(allowedTags).toContain('blockquote');
      expect(allowedTags).toContain('q');
      expect(allowedTags).toContain('cite');
      expect(allowedTags).toContain('abbr');
    });

    it('allows details/summary elements', () => {
      expect(allowedTags).toContain('details');
      expect(allowedTags).toContain('summary');
    });

    it('allows figure/figcaption elements', () => {
      expect(allowedTags).toContain('figure');
      expect(allowedTags).toContain('figcaption');
    });

    it('allows definition list elements', () => {
      expect(allowedTags).toContain('dl');
      expect(allowedTags).toContain('dt');
      expect(allowedTags).toContain('dd');
    });

    it('BLOCKS dangerous script tag', () => {
      expect(allowedTags).not.toContain('script');
    });

    it('BLOCKS style tag', () => {
      expect(allowedTags).not.toContain('style');
    });

    it('BLOCKS iframe element', () => {
      expect(allowedTags).not.toContain('iframe');
    });

    it('BLOCKS embed element', () => {
      expect(allowedTags).not.toContain('embed');
    });

    it('BLOCKS object element', () => {
      expect(allowedTags).not.toContain('object');
    });

    it('BLOCKS form element', () => {
      expect(allowedTags).not.toContain('form');
    });

    it('BLOCKS input element', () => {
      expect(allowedTags).not.toContain('input');
    });

    it('BLOCKS button element', () => {
      expect(allowedTags).not.toContain('button');
    });

    it('BLOCKS textarea element', () => {
      expect(allowedTags).not.toContain('textarea');
    });

    it('BLOCKS select element', () => {
      expect(allowedTags).not.toContain('select');
    });

    describe('KaTeX math elements', () => {
      it('allows math element', () => {
        expect(allowedTags).toContain('math');
      });

      it('allows common MathML elements', () => {
        const mathElements = [
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
        ];
        for (const tag of mathElements) {
          expect(allowedTags).toContain(tag);
        }
      });
    });

    describe('SVG elements for Mermaid', () => {
      it('allows svg element', () => {
        expect(allowedTags).toContain('svg');
      });

      it('allows common SVG elements', () => {
        const svgElements = [
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
          'mask',
          'marker',
          'use',
          'symbol',
        ];
        for (const tag of svgElements) {
          expect(allowedTags).toContain(tag);
        }
      });

      it('BLOCKS foreignObject (XSS vector)', () => {
        expect(allowedTags).not.toContain('foreignObject');
      });
    });
  });

  describe('ALLOWED_ATTR', () => {
    const allowedAttrs = DOMPURIFY_CONFIG.ALLOWED_ATTR || [];

    it('allows common safe attributes', () => {
      const safeAttrs = [
        'href',
        'src',
        'alt',
        'title',
        'class',
        'id',
        'name',
        'target',
        'rel',
        'width',
        'height',
      ];
      for (const attr of safeAttrs) {
        expect(allowedAttrs).toContain(attr);
      }
    });

    it('allows table attributes', () => {
      expect(allowedAttrs).toContain('colspan');
      expect(allowedAttrs).toContain('rowspan');
      expect(allowedAttrs).toContain('scope');
    });

    it('allows image loading attributes', () => {
      expect(allowedAttrs).toContain('loading');
      expect(allowedAttrs).toContain('decoding');
    });

    it('allows style attribute (for KaTeX)', () => {
      expect(allowedAttrs).toContain('style');
    });

    it('allows SVG attributes', () => {
      const svgAttrs = [
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
        'points',
      ];
      for (const attr of svgAttrs) {
        expect(allowedAttrs).toContain(attr);
      }
    });

    it('allows MathML attributes', () => {
      const mathAttrs = [
        'mathvariant',
        'encoding',
        'stretchy',
        'fence',
        'lspace',
        'rspace',
        'xmlns',
      ];
      for (const attr of mathAttrs) {
        expect(allowedAttrs).toContain(attr);
      }
    });

    it('allows Mermaid data attributes', () => {
      expect(allowedAttrs).toContain('data-mermaid-chart');
      expect(allowedAttrs).toContain('data-mermaid-id');
    });

    it('allows admonition data attribute', () => {
      expect(allowedAttrs).toContain('data-admonition-type');
    });

    it('DOES NOT allow event handlers by default', () => {
      // DOMPurify blocks event handlers by default
      // These would be in ALLOWED_ATTR if explicitly allowed
      const eventHandlers = [
        'onclick',
        'onerror',
        'onload',
        'onmouseover',
        'onfocus',
        'onblur',
        'onsubmit',
        'onchange',
      ];
      for (const handler of eventHandlers) {
        expect(allowedAttrs).not.toContain(handler);
      }
    });
  });

  describe('Protocol restrictions', () => {
    it('has ALLOW_UNKNOWN_PROTOCOLS set to false', () => {
      expect(DOMPURIFY_CONFIG.ALLOW_UNKNOWN_PROTOCOLS).toBe(false);
    });

    it('has ALLOWED_URI_REGEXP defined', () => {
      expect(DOMPURIFY_CONFIG.ALLOWED_URI_REGEXP).toBeDefined();
    });

    it('ALLOWED_URI_REGEXP allows https URLs', () => {
      const regexp = DOMPURIFY_CONFIG.ALLOWED_URI_REGEXP;
      if (regexp) {
        expect('https://example.com').toMatch(regexp);
      }
    });

    it('ALLOWED_URI_REGEXP allows http URLs', () => {
      const regexp = DOMPURIFY_CONFIG.ALLOWED_URI_REGEXP;
      if (regexp) {
        expect('http://example.com').toMatch(regexp);
      }
    });

    it('ALLOWED_URI_REGEXP allows mailto URLs', () => {
      const regexp = DOMPURIFY_CONFIG.ALLOWED_URI_REGEXP;
      if (regexp) {
        expect('mailto:test@example.com').toMatch(regexp);
      }
    });

    it('ALLOWED_URI_REGEXP allows tel URLs', () => {
      const regexp = DOMPURIFY_CONFIG.ALLOWED_URI_REGEXP;
      if (regexp) {
        expect('tel:+1234567890').toMatch(regexp);
      }
    });

    it('ALLOWED_URI_REGEXP allows relative URLs', () => {
      const regexp = DOMPURIFY_CONFIG.ALLOWED_URI_REGEXP;
      if (regexp) {
        expect('./page.html').toMatch(regexp);
        expect('../page.html').toMatch(regexp);
        expect('/page.html').toMatch(regexp);
      }
    });

    it('ALLOWED_URI_REGEXP allows anchor URLs', () => {
      const regexp = DOMPURIFY_CONFIG.ALLOWED_URI_REGEXP;
      if (regexp) {
        expect('#section').toMatch(regexp);
      }
    });
  });

  describe('Additional security settings', () => {
    it('has ADD_ATTR for target and rel', () => {
      const addAttr = DOMPURIFY_CONFIG.ADD_ATTR || [];
      expect(addAttr).toContain('target');
      expect(addAttr).toContain('rel');
    });
  });
});

describe('XSS Attack Vector Coverage', () => {
  // document XSS vectors that the config blocks (verify config coverage)

  describe('Script injection vectors', () => {
    it('config blocks script tag', () => {
      expect(DOMPURIFY_CONFIG.ALLOWED_TAGS).not.toContain('script');
    });

    it('config blocks event handlers (not in allowed attrs)', () => {
      const allowedAttrs = DOMPURIFY_CONFIG.ALLOWED_ATTR || [];
      expect(allowedAttrs).not.toContain('onclick');
      expect(allowedAttrs).not.toContain('onerror');
      expect(allowedAttrs).not.toContain('onload');
    });
  });

  describe('Data URL vectors', () => {
    it('config has strict URI regex', () => {
      expect(DOMPURIFY_CONFIG.ALLOW_UNKNOWN_PROTOCOLS).toBe(false);
      expect(DOMPURIFY_CONFIG.ALLOWED_URI_REGEXP).toBeDefined();
    });
  });

  describe('SVG XSS vectors', () => {
    it('config blocks foreignObject', () => {
      expect(DOMPURIFY_CONFIG.ALLOWED_TAGS).not.toContain('foreignObject');
    });

    it('config allows safe SVG elements', () => {
      expect(DOMPURIFY_CONFIG.ALLOWED_TAGS).toContain('svg');
      expect(DOMPURIFY_CONFIG.ALLOWED_TAGS).toContain('path');
      expect(DOMPURIFY_CONFIG.ALLOWED_TAGS).toContain('rect');
    });
  });

  describe('Form hijacking vectors', () => {
    it('config blocks form elements', () => {
      const allowedTags = DOMPURIFY_CONFIG.ALLOWED_TAGS || [];
      expect(allowedTags).not.toContain('form');
      expect(allowedTags).not.toContain('input');
      expect(allowedTags).not.toContain('button');
      expect(allowedTags).not.toContain('select');
      expect(allowedTags).not.toContain('textarea');
    });
  });

  describe('CSS injection vectors', () => {
    it('config blocks style tag', () => {
      expect(DOMPURIFY_CONFIG.ALLOWED_TAGS).not.toContain('style');
    });

    it('config allows style attribute (limited by DOMPurify internal rules)', () => {
      // style attr needed for KaTeX (DOMPurify filters dangerous CSS)
      expect(DOMPURIFY_CONFIG.ALLOWED_ATTR).toContain('style');
    });
  });

  describe('Embed/Object vectors', () => {
    it('config blocks embed tags', () => {
      const allowedTags = DOMPURIFY_CONFIG.ALLOWED_TAGS || [];
      expect(allowedTags).not.toContain('embed');
      expect(allowedTags).not.toContain('object');
      expect(allowedTags).not.toContain('applet');
    });
  });

  describe('Frame vectors', () => {
    it('config blocks frame elements', () => {
      const allowedTags = DOMPURIFY_CONFIG.ALLOWED_TAGS || [];
      expect(allowedTags).not.toContain('iframe');
      expect(allowedTags).not.toContain('frame');
      expect(allowedTags).not.toContain('frameset');
    });
  });

  describe('Base tag hijacking', () => {
    it('config blocks base tag', () => {
      expect(DOMPURIFY_CONFIG.ALLOWED_TAGS).not.toContain('base');
    });
  });

  describe('Meta redirect vectors', () => {
    it('config blocks meta tag', () => {
      expect(DOMPURIFY_CONFIG.ALLOWED_TAGS).not.toContain('meta');
    });
  });

  describe('Link preload vectors', () => {
    it('config blocks link tag', () => {
      expect(DOMPURIFY_CONFIG.ALLOWED_TAGS).not.toContain('link');
    });
  });
});
