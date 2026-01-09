// packages/extension/test/mdx-safe.test.ts
// tests for Safe Mode MDX compilation

import { describe, it, expect } from 'vitest';
import { compileToSafeHTML } from '../transpiler/mdx/mdx-safe';

describe('mdx-safe', () => {
  describe('compileToSafeHTML', () => {
    describe('basic markdown', () => {
      it('compiles paragraphs', async () => {
        const result = await compileToSafeHTML('Hello world');
        // includes data-sourcepos for scroll sync
        expect(result.html).toContain('<p');
        expect(result.html).toContain('Hello world');
        expect(result.html).toContain('</p>');
      });

      it('compiles headings', async () => {
        const result = await compileToSafeHTML('# Title\n## Subtitle');
        expect(result.html).toContain('<h1');
        expect(result.html).toContain('Title');
        expect(result.html).toContain('<h2');
        expect(result.html).toContain('Subtitle');
      });

      it('compiles links', async () => {
        const result = await compileToSafeHTML('[Link](https://example.com)');
        expect(result.html).toContain('<a');
        expect(result.html).toContain('href="https://example.com"');
      });

      it('compiles code blocks', async () => {
        const result = await compileToSafeHTML('```js\nconst x = 1;\n```');
        expect(result.html).toContain('<pre');
        expect(result.html).toContain('<code');
      });

      it('compiles inline code', async () => {
        const result = await compileToSafeHTML('Use `const` here');
        expect(result.html).toContain('<code');
        expect(result.html).toContain('const');
      });

      it('compiles emphasis', async () => {
        const result = await compileToSafeHTML('*italic* and **bold**');
        expect(result.html).toContain('<em>');
        expect(result.html).toContain('<strong>');
      });
    });

    describe('frontmatter extraction', () => {
      it('extracts frontmatter', async () => {
        const mdx = `---
title: My Doc
author: Jane
---

Content here`;

        const result = await compileToSafeHTML(mdx);

        expect(result.frontmatter).toEqual({
          title: 'My Doc',
          author: 'Jane',
        });
      });

      it('excludes frontmatter from HTML', async () => {
        const mdx = `---
title: My Doc
---

Content here`;

        const result = await compileToSafeHTML(mdx);

        expect(result.html).not.toContain('title: My Doc');
        expect(result.html).toContain('Content here');
      });

      it('returns empty object for no frontmatter', async () => {
        const result = await compileToSafeHTML('Just content');

        expect(result.frontmatter).toEqual({});
      });

      it('handles complex frontmatter values', async () => {
        const mdx = `---
title: Test
tags:
  - react
  - mdx
published: true
count: 42
---

Content`;

        const result = await compileToSafeHTML(mdx);

        expect(result.frontmatter.title).toBe('Test');
        expect(result.frontmatter.tags).toEqual(['react', 'mdx']);
        expect(result.frontmatter.published).toBe(true);
        expect(result.frontmatter.count).toBe(42);
      });
    });

    describe('JSX element stripping', () => {
      it('replaces JSX flow elements with placeholder', async () => {
        const result = await compileToSafeHTML('<MyComponent />');

        expect(result.html).toContain('mdx-jsx-placeholder');
        expect(result.html).toContain('&lt;MyComponent');
        expect(result.html).not.toContain('<MyComponent');
      });

      it('replaces JSX text elements with placeholder', async () => {
        const result = await compileToSafeHTML(
          'Hello <Highlight>world</Highlight>'
        );

        expect(result.html).toContain('mdx-jsx-placeholder');
        expect(result.html).toContain('&lt;Highlight');
      });

      it('handles components with props', async () => {
        const result = await compileToSafeHTML(
          '<Button variant="primary">Click</Button>'
        );

        expect(result.html).toContain('mdx-jsx-placeholder');
        expect(result.html).toContain('&lt;Button');
      });

      it('handles self-closing components', async () => {
        const result = await compileToSafeHTML('<Icon name="star" />');

        expect(result.html).toContain('mdx-jsx-placeholder');
        expect(result.html).toContain('&lt;Icon');
      });
    });

    describe('expression stripping', () => {
      it('replaces flow expressions with placeholder', async () => {
        const result = await compileToSafeHTML('{someVariable}');

        expect(result.html).toContain('mdx-expression-placeholder');
        expect(result.html).toContain('{...}');
      });

      it('replaces inline expressions with placeholder', async () => {
        const result = await compileToSafeHTML('Value is {count}.');

        expect(result.html).toContain('mdx-expression-placeholder');
      });

      it('replaces complex expressions', async () => {
        const result = await compileToSafeHTML('{items.map(i => i.name)}');

        expect(result.html).toContain('mdx-expression-placeholder');
        expect(result.html).not.toContain('items.map');
      });
    });

    describe('import/export removal', () => {
      it('removes import statements', async () => {
        const mdx = `import React from 'react';
import { Button } from './Button';

# Hello`;

        const result = await compileToSafeHTML(mdx);

        expect(result.html).not.toContain('import');
        expect(result.html).toContain('<h1');
        expect(result.html).toContain('Hello');
      });

      it('removes export statements', async () => {
        const mdx = `export const meta = { title: 'Test' };

# Content`;

        const result = await compileToSafeHTML(mdx);

        expect(result.html).not.toContain('export');
        expect(result.html).not.toContain('meta');
        expect(result.html).toContain('Content');
      });
    });

    describe('GFM support', () => {
      it('compiles tables', async () => {
        const mdx = `| A | B |
|---|---|
| 1 | 2 |`;

        const result = await compileToSafeHTML(mdx);

        expect(result.html).toContain('<table');
        expect(result.html).toContain('<th');
        expect(result.html).toContain('<td');
      });

      it('compiles strikethrough', async () => {
        const result = await compileToSafeHTML('~~deleted~~');

        expect(result.html).toContain('<del');
        expect(result.html).toContain('deleted');
      });

      it('compiles task lists', async () => {
        const result = await compileToSafeHTML('- [x] Done\n- [ ] Todo');

        expect(result.html).toContain('type="checkbox"');
      });

      it('compiles autolinks', async () => {
        const result = await compileToSafeHTML('Visit https://example.com');

        expect(result.html).toContain('<a');
        expect(result.html).toContain('https://example.com');
      });
    });

    describe('math support', () => {
      it('compiles inline math', async () => {
        const result = await compileToSafeHTML('Equation: $E = mc^2$');

        // KaTeX renders math elements
        expect(result.html).toContain('katex');
      });

      it('compiles block math', async () => {
        const result = await compileToSafeHTML('$$\nx = \\frac{-b}{2a}\n$$');

        expect(result.html).toContain('katex');
      });
    });

    describe('Mermaid placeholders', () => {
      it('creates mermaid placeholder for mermaid code blocks', async () => {
        const result = await compileToSafeHTML(
          '```mermaid\ngraph TD\nA-->B\n```'
        );

        expect(result.html).toContain('data-mermaid-chart');
      });
    });

    describe('error handling', () => {
      it('handles empty input', async () => {
        const result = await compileToSafeHTML('');

        expect(result.html).toBe('');
        expect(result.frontmatter).toEqual({});
      });

      it('handles whitespace-only input', async () => {
        const result = await compileToSafeHTML('   \n\n   ');

        expect(result.frontmatter).toEqual({});
      });
    });
  });
});
