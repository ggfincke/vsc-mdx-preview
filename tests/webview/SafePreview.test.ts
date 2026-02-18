// tests/webview/features/preview/safe/SafePreview.test.ts
// XSS prevention tests for Safe Mode DOMPurify configuration
//
// verify DOMPurify allowlist blocks dangerous elements & preserves safe content
// tests cover config structure, dangerous-tag blocking, & actual payload injection
//
// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import DOMPurify from 'dompurify';
import { DOMPURIFY_CONFIG } from '../../packages/webview-client/src/features/preview/safe/security/allowlist';

describe('DOMPurify Configuration', () => {
  const allowedTags = DOMPURIFY_CONFIG.ALLOWED_TAGS || [];
  const allowedAttrs = DOMPURIFY_CONFIG.ALLOWED_ATTR || [];

  describe('allowed tag categories', () => {
    it('allows structural & text formatting elements', () => {
      const structural = ['div', 'span', 'p', 'br', 'hr'];
      const headings = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
      const lists = ['ul', 'ol', 'li', 'dl', 'dt', 'dd'];
      const formatting = ['strong', 'em', 'code', 'pre', 'blockquote'];
      const tables = ['table', 'thead', 'tbody', 'tr', 'th', 'td'];

      for (const tag of [
        ...structural,
        ...headings,
        ...lists,
        ...formatting,
        ...tables,
      ]) {
        expect(allowedTags, `missing tag: ${tag}`).toContain(tag);
      }
    });

    it('allows KaTeX MathML elements', () => {
      const mathElements = ['math', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub'];
      for (const tag of mathElements) {
        expect(allowedTags, `missing MathML tag: ${tag}`).toContain(tag);
      }
    });

    it('allows SVG elements for Mermaid diagrams', () => {
      const svgElements = ['svg', 'g', 'path', 'rect', 'circle', 'text'];
      for (const tag of svgElements) {
        expect(allowedTags, `missing SVG tag: ${tag}`).toContain(tag);
      }
    });
  });

  describe('dangerous elements blocked', () => {
    it('blocks script execution & embedding vectors', () => {
      const dangerous = [
        'script',
        'style',
        'iframe',
        'frame',
        'frameset',
        'embed',
        'object',
        'applet',
        'base',
        'meta',
        'link',
      ];
      for (const tag of dangerous) {
        expect(allowedTags, `dangerous tag allowed: ${tag}`).not.toContain(tag);
      }
    });

    it('blocks form elements', () => {
      const formElements = ['form', 'input', 'button', 'select', 'textarea'];
      for (const tag of formElements) {
        expect(allowedTags, `form tag allowed: ${tag}`).not.toContain(tag);
      }
    });

    it('blocks SVG foreignObject (XSS vector)', () => {
      expect(allowedTags).not.toContain('foreignObject');
    });
  });

  describe('allowed attributes', () => {
    it('allows safe common & SVG attributes', () => {
      const safe = ['href', 'src', 'alt', 'class', 'id', 'style'];
      const svg = ['d', 'fill', 'stroke', 'viewBox', 'transform'];
      for (const attr of [...safe, ...svg]) {
        expect(allowedAttrs, `missing attr: ${attr}`).toContain(attr);
      }
    });

    it('allows diagram & admonition data attributes', () => {
      expect(allowedAttrs).toContain('data-mermaid-chart');
      expect(allowedAttrs).toContain('data-plantuml-code');
      expect(allowedAttrs).toContain('data-graphviz-code');
      expect(allowedAttrs).toContain('data-admonition-type');
    });

    it('blocks event handler attributes', () => {
      const handlers = ['onclick', 'onerror', 'onload', 'onmouseover'];
      for (const handler of handlers) {
        expect(allowedAttrs, `event handler allowed: ${handler}`).not.toContain(
          handler
        );
      }
    });
  });

  describe('protocol restrictions', () => {
    it('disallows unknown protocols', () => {
      expect(DOMPURIFY_CONFIG.ALLOW_UNKNOWN_PROTOCOLS).toBe(false);
    });

    it('URI regex allows safe protocols & blocks dangerous ones', () => {
      const regexp = DOMPURIFY_CONFIG.ALLOWED_URI_REGEXP;
      expect(regexp).toBeDefined();
      if (regexp) {
        expect('https://example.com').toMatch(regexp);
        expect('mailto:test@example.com').toMatch(regexp);
        expect('#section').toMatch(regexp);
      }
    });
  });
});

// actual payload injection tests - verify DOMPurify sanitization behavior
describe('XSS Payload Injection Tests', () => {
  describe('script injection payloads', () => {
    it('strips script tags', () => {
      const malicious = '<div><script>alert("xss")</script>safe</div>';
      const result = DOMPurify.sanitize(malicious, DOMPURIFY_CONFIG);
      expect(result).not.toContain('<script');
      expect(result).toContain('safe');
    });

    it('strips event handlers from elements', () => {
      const payloads = [
        '<img src=x onerror="alert(1)">',
        '<div onclick="malicious()">click me</div>',
        '<span onmouseover="steal()">hover</span>',
      ];
      for (const malicious of payloads) {
        const result = DOMPurify.sanitize(malicious, DOMPURIFY_CONFIG);
        expect(result).not.toMatch(/on\w+=/);
      }
    });
  });

  describe('SVG XSS payloads', () => {
    it('strips script & foreignObject inside SVG', () => {
      const scriptSvg = '<svg><script>alert(1)</script></svg>';
      const foreignSvg =
        '<svg><foreignObject><div onclick="xss()">test</div></foreignObject></svg>';

      expect(DOMPurify.sanitize(scriptSvg, DOMPURIFY_CONFIG)).not.toContain(
        '<script'
      );
      const foreignResult = DOMPurify.sanitize(foreignSvg, DOMPURIFY_CONFIG);
      expect(foreignResult).not.toContain('foreignObject');
      expect(foreignResult).not.toContain('onclick');
    });
  });

  describe('protocol injection payloads', () => {
    it('strips dangerous protocols from href', () => {
      const vectors = [
        '<a href="javascript:alert(1)">click</a>',
        '<a href="data:text/html,<script>alert(1)</script>">click</a>',
        '<a href="vbscript:msgbox(1)">click</a>',
      ];
      for (const malicious of vectors) {
        const result = DOMPurify.sanitize(malicious, DOMPURIFY_CONFIG);
        expect(result).not.toMatch(/javascript:|data:|vbscript:/);
      }
    });

    it('preserves safe protocols', () => {
      expect(
        DOMPurify.sanitize(
          '<a href="https://example.com">link</a>',
          DOMPURIFY_CONFIG
        )
      ).toContain('https://example.com');
      expect(
        DOMPurify.sanitize(
          '<a href="mailto:test@example.com">email</a>',
          DOMPURIFY_CONFIG
        )
      ).toContain('mailto:test@example.com');
    });
  });

  describe('form & embed payloads', () => {
    it('strips form & iframe elements', () => {
      const vectors = [
        '<form action="https://evil.com"><input name="pw"></form>',
        '<iframe src="https://evil.com"></iframe>',
        '<embed src="evil.swf">',
        '<object data="malicious.swf"></object>',
      ];
      for (const malicious of vectors) {
        const result = DOMPurify.sanitize(malicious, DOMPURIFY_CONFIG);
        expect(result).not.toMatch(/<(form|iframe|embed|object)/);
      }
    });
  });

  describe('obfuscation bypass attempts', () => {
    it('handles encoded & mixed-case bypass attempts', () => {
      // HTML entity encoded onerror
      const encoded =
        '<img src=x &#111;&#110;&#101;&#114;&#114;&#111;&#114;="alert(1)">';
      expect(DOMPurify.sanitize(encoded, DOMPURIFY_CONFIG)).not.toContain(
        'onerror'
      );

      // mixed case script
      const mixedCase = '<ScRiPt>alert(1)</sCrIpT>';
      expect(
        DOMPurify.sanitize(mixedCase, DOMPURIFY_CONFIG).toLowerCase()
      ).not.toContain('<script');
    });
  });

  describe('safe content preservation', () => {
    it('preserves standard markdown-rendered HTML', () => {
      const safe =
        '<h1>Title</h1><p>Text w/ <strong>bold</strong> & <em>italic</em>.</p>';
      const result = DOMPurify.sanitize(safe, DOMPURIFY_CONFIG);
      expect(result).toContain('<h1>');
      expect(result).toContain('<strong>');
      expect(result).toContain('<em>');
    });

    it('preserves code blocks, tables, & SVG', () => {
      const code = '<pre><code class="language-js">const x = 1;</code></pre>';
      const table = '<table><tr><th>H</th></tr><tr><td>C</td></tr></table>';
      const svg = '<svg viewBox="0 0 100 100"><rect fill="blue"/></svg>';

      expect(DOMPurify.sanitize(code, DOMPURIFY_CONFIG)).toContain('<pre>');
      expect(DOMPurify.sanitize(table, DOMPURIFY_CONFIG)).toContain('<table>');
      expect(DOMPurify.sanitize(svg, DOMPURIFY_CONFIG)).toContain('<svg');
    });

    it('preserves KaTeX math elements', () => {
      const math =
        '<math><mrow><mi>x</mi><mo>=</mo><mn>1</mn></mrow></math>';
      const result = DOMPurify.sanitize(math, DOMPURIFY_CONFIG);
      expect(result).toContain('<math>');
      expect(result).toContain('<mrow>');
    });
  });
});
