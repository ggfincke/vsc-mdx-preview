// tests/extension/compiler/create-diagram-placeholder.test.ts
// unit tests for the diagram placeholder rehype plugin factory

import { describe, it, expect } from 'vitest';
import { createDiagramPlaceholder } from '../../../packages/extension-host/src/features/compilation/pipeline/rehype/create-diagram-placeholder';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';

// run markdown through a placeholder plugin & return HTML
async function processMarkdown(
  md: string,
  plugin: ReturnType<typeof createDiagramPlaceholder>
): Promise<string> {
  const result = await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(plugin)
    .use(rehypeStringify)
    .process(md);
  return String(result);
}

describe('createDiagramPlaceholder', () => {
  const testPlugin = createDiagramPlaceholder({
    name: 'test',
    languages: [{ className: 'language-test', id: 'test' }],
    containerClass: 'test-container',
    codeAttr: 'data-test-code',
    idAttr: 'data-test-id',
  });

  it('replaces matching code block w/ placeholder div', async () => {
    const html = await processMarkdown('```test\nhello\n```', testPlugin);
    expect(html).toContain('test-container');
    expect(html).toContain('data-test-code');
    expect(html).toContain('data-test-id');
    expect(html).not.toContain('<pre');
  });

  it('preserves code content in data attribute', async () => {
    const html = await processMarkdown(
      '```test\ngraph TD;\nA-->B\n```',
      testPlugin
    );
    expect(html).toContain('graph TD;');
    expect(html).toContain('A-->B');
  });

  it('ignores non-matching code blocks', async () => {
    const html = await processMarkdown(
      '```javascript\nconst x = 1;\n```',
      testPlugin
    );
    expect(html).not.toContain('test-container');
    expect(html).toContain('<pre');
  });

  it('skips empty code blocks', async () => {
    const html = await processMarkdown('```test\n   \n```', testPlugin);
    expect(html).not.toContain('test-container');
  });

  it('supports multiple language aliases', async () => {
    const multiPlugin = createDiagramPlaceholder({
      name: 'multi',
      languages: [
        { className: 'language-alpha', id: 'alpha' },
        { className: 'language-beta', id: 'beta' },
      ],
      containerClass: 'multi-container',
      codeAttr: 'data-multi-code',
      idAttr: 'data-multi-id',
    });

    const htmlAlpha = await processMarkdown(
      '```alpha\nfoo\n```',
      multiPlugin
    );
    expect(htmlAlpha).toContain('multi-container');

    const htmlBeta = await processMarkdown(
      '```beta\nbar\n```',
      multiPlugin
    );
    expect(htmlBeta).toContain('multi-container');
  });

  it('includes extra attributes when configured', async () => {
    const extraPlugin = createDiagramPlaceholder({
      name: 'extra',
      languages: [
        { className: 'language-x', id: 'x' },
        { className: 'language-y', id: 'y' },
      ],
      containerClass: 'extra-container',
      codeAttr: 'data-extra-code',
      idAttr: 'data-extra-id',
      extraAttributes: (lang) => ({ 'data-extra-language': lang }),
    });

    const htmlX = await processMarkdown('```x\ncontent\n```', extraPlugin);
    expect(htmlX).toContain('data-extra-language="x"');

    const htmlY = await processMarkdown('```y\ncontent\n```', extraPlugin);
    expect(htmlY).toContain('data-extra-language="y"');
  });

  it('generates unique IDs w/ diagram name prefix', async () => {
    const html = await processMarkdown('```test\nhello\n```', testPlugin);
    // ID attribute should start w/ "test-"
    const match = html.match(/data-test-id="(test-[^"]+)"/);
    expect(match).not.toBeNull();
    expect(match![1]).toMatch(/^test-\d+-[a-z0-9]+$/);
  });
});
