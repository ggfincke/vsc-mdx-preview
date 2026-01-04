// packages/extension/test/remark-github-alerts.test.ts
// tests for GitHub-style blockquote alerts plugin

import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGithubAlerts from '../transpiler/mdx/remark-github-alerts';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';

// helper to process markdown & return HTML
async function processMarkdown(markdown: string): Promise<string> {
  const result = await unified()
    .use(remarkParse)
    .use(remarkGithubAlerts)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(markdown);

  return String(result);
}

describe('remark-github-alerts', () => {
  describe('alert detection', () => {
    it('transforms [!NOTE] blockquote to alert', async () => {
      const input = `> [!NOTE]
> This is a note.`;
      const html = await processMarkdown(input);

      expect(html).toContain('class="github-alert github-alert-note"');
      expect(html).toContain('role="note"');
      expect(html).toContain('<span>Note</span>');
      expect(html).toContain('This is a note.');
    });

    it('transforms [!TIP] blockquote to alert', async () => {
      const input = `> [!TIP]
> This is a tip.`;
      const html = await processMarkdown(input);

      expect(html).toContain('github-alert-tip');
      expect(html).toContain('<span>Tip</span>');
    });

    it('transforms [!IMPORTANT] blockquote to alert', async () => {
      const input = `> [!IMPORTANT]
> This is important.`;
      const html = await processMarkdown(input);

      expect(html).toContain('github-alert-important');
      expect(html).toContain('<span>Important</span>');
    });

    it('transforms [!WARNING] blockquote to alert', async () => {
      const input = `> [!WARNING]
> This is a warning.`;
      const html = await processMarkdown(input);

      expect(html).toContain('github-alert-warning');
      expect(html).toContain('<span>Warning</span>');
    });

    it('transforms [!CAUTION] blockquote to alert', async () => {
      const input = `> [!CAUTION]
> This is a caution.`;
      const html = await processMarkdown(input);

      expect(html).toContain('github-alert-caution');
      expect(html).toContain('<span>Caution</span>');
    });
  });

  describe('case insensitivity', () => {
    it('handles lowercase [!note]', async () => {
      const input = `> [!note]
> Lowercase.`;
      const html = await processMarkdown(input);

      expect(html).toContain('github-alert-note');
    });

    it('handles mixed case [!Note]', async () => {
      const input = `> [!Note]
> Mixed case.`;
      const html = await processMarkdown(input);

      expect(html).toContain('github-alert-note');
    });
  });

  describe('regular blockquotes', () => {
    it('does not transform regular blockquotes', async () => {
      const input = `> This is a regular blockquote.`;
      const html = await processMarkdown(input);

      expect(html).toContain('<blockquote>');
      expect(html).not.toContain('github-alert');
    });

    it('does not transform blockquotes with invalid alert type', async () => {
      const input = `> [!INVALID]
> This should stay as blockquote.`;
      const html = await processMarkdown(input);

      expect(html).toContain('<blockquote>');
      expect(html).not.toContain('github-alert');
    });
  });

  describe('content handling', () => {
    it('handles multiple lines of content', async () => {
      const input = `> [!NOTE]
> First line.
> Second line.`;
      const html = await processMarkdown(input);

      expect(html).toContain('github-alert-note');
      // both lines should appear
      expect(html).toContain('First line.');
      expect(html).toContain('Second line.');
    });

    it('handles alert with text on same line as marker', async () => {
      const input = `> [!NOTE] Important note here.`;
      const html = await processMarkdown(input);

      expect(html).toContain('github-alert-note');
      expect(html).toContain('Important note here.');
    });
  });

  describe('icons', () => {
    it('includes SVG icon in alert', async () => {
      const input = `> [!NOTE]
> With icon.`;
      const html = await processMarkdown(input);

      expect(html).toContain('<svg');
      expect(html).toContain('</svg>');
    });
  });
});
