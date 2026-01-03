// packages/extension/test/rehype-sourcepos.test.ts
// unit tests for rehype-sourcepos plugin

import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import rehypeSourcepos from '../transpiler/mdx/rehype-sourcepos';

// helper to compile markdown and extract HTML
async function processMarkdown(md: string): Promise<string> {
  const result = await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeSourcepos)
    .use(rehypeStringify)
    .process(md);
  return String(result);
}

describe('rehype-sourcepos', () => {
  describe('block element handling', () => {
    it('should add data-sourcepos to headings', async () => {
      const result = await processMarkdown('# Heading 1');
      expect(result).toContain('data-sourcepos="1:1-1:12"');
      expect(result).toContain('<h1');
    });

    it('should add data-sourcepos to paragraphs', async () => {
      const result = await processMarkdown('This is a paragraph.');
      expect(result).toContain('data-sourcepos="1:1-1:21"');
      expect(result).toContain('<p');
    });

    it('should add data-sourcepos to lists', async () => {
      const result = await processMarkdown('- item 1\n- item 2');
      expect(result).toContain('<ul');
      expect(result).toContain('<li');
      // list should have sourcepos
      expect(result).toMatch(/data-sourcepos="1:1-2:\d+"/);
    });

    it('should add data-sourcepos to blockquotes', async () => {
      const result = await processMarkdown('> quoted text');
      expect(result).toContain('<blockquote');
      expect(result).toContain('data-sourcepos');
    });

    it('should add data-sourcepos to code blocks', async () => {
      const result = await processMarkdown('```\ncode\n```');
      expect(result).toContain('<pre');
      expect(result).toContain('data-sourcepos');
    });

    it('should add data-sourcepos to horizontal rules', async () => {
      const result = await processMarkdown('---');
      expect(result).toContain('<hr');
      expect(result).toContain('data-sourcepos');
    });

    it('should add data-sourcepos to tables (with GFM)', async () => {
      // tables require remark-gfm to parse; without it they're treated as paragraphs
      // this test verifies the plugin doesn't break on table-like input
      const result = await processMarkdown('| A | B |\n|---|---|\n| 1 | 2 |');
      // without GFM, this is treated as a paragraph - that's expected
      expect(result).toContain('data-sourcepos');
    });
  });

  describe('inline element handling', () => {
    it('should NOT add data-sourcepos to inline elements', async () => {
      const result = await processMarkdown('This is **bold** and *italic*.');
      // inline strong/em should not have sourcepos
      expect(result).not.toMatch(/<strong[^>]*data-sourcepos/);
      expect(result).not.toMatch(/<em[^>]*data-sourcepos/);
    });

    it('should NOT add data-sourcepos to links', async () => {
      const result = await processMarkdown('[link](http://example.com)');
      // a tags should not have sourcepos (they're inline)
      expect(result).not.toMatch(/<a[^>]*data-sourcepos/);
    });

    it('should NOT add data-sourcepos to inline code', async () => {
      const result = await processMarkdown('This is `inline code`.');
      // inline code should not have sourcepos
      expect(result).not.toMatch(/<code[^>]*data-sourcepos/);
    });
  });

  describe('sourcepos format', () => {
    it('should use format "startLine:startCol-endLine:endCol"', async () => {
      const result = await processMarkdown('# Test');
      // should match the format 1:1-1:7
      expect(result).toMatch(/data-sourcepos="\d+:\d+-\d+:\d+"/);
    });

    it('should use 1-based line numbers', async () => {
      const result = await processMarkdown('# First line');
      // first line should be line 1
      expect(result).toContain('data-sourcepos="1:');
    });

    it('should track multi-line elements correctly', async () => {
      const md = `# Heading

Paragraph on line 3.`;
      const result = await processMarkdown(md);
      // heading on line 1
      expect(result).toMatch(/<h1[^>]*data-sourcepos="1:/);
      // paragraph on line 3
      expect(result).toMatch(/<p[^>]*data-sourcepos="3:/);
    });
  });

  describe('edge cases', () => {
    it('should handle empty input', async () => {
      const result = await processMarkdown('');
      expect(result).toBe('');
    });

    it('should handle whitespace-only input', async () => {
      const result = await processMarkdown('   \n\n   ');
      expect(result).toBe('');
    });

    it('should handle deeply nested elements', async () => {
      const md = `> - nested
>   - deeply`;
      const result = await processMarkdown(md);
      // should not throw and should contain blockquote
      expect(result).toContain('<blockquote');
    });
  });
});
