// packages/extension/test/rehype-mermaid-placeholder.test.ts
// unit tests for rehype-mermaid-placeholder plugin

import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import rehypeMermaidPlaceholder from '../transpiler/mdx/rehype-mermaid-placeholder';

// helper to compile markdown to HTML w/ mermaid placeholder plugin
async function compile(markdown: string): Promise<string> {
  const result = await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeMermaidPlaceholder)
    .use(rehypeStringify)
    .process(markdown);
  return String(result);
}

describe('rehypeMermaidPlaceholder', () => {
  it('transforms mermaid code blocks to placeholder divs', async () => {
    const markdown = `# Test

\`\`\`mermaid
flowchart TD
    A --> B
\`\`\`
`;
    const html = await compile(markdown);

    expect(html).toContain('class="mermaid-container"');
    expect(html).toContain('data-mermaid-chart');
    expect(html).toContain('data-mermaid-id');
    expect(html).toContain('flowchart TD');
    expect(html).not.toContain('<pre>');
    expect(html).not.toContain('language-mermaid');
  });

  it('preserves non-mermaid code blocks', async () => {
    const markdown = `\`\`\`javascript
const x = 1;
\`\`\`
`;
    const html = await compile(markdown);

    expect(html).toContain('<pre>');
    expect(html).toContain('<code');
    expect(html).toContain('language-javascript');
    expect(html).not.toContain('mermaid-container');
  });

  it('ignores empty mermaid code blocks', async () => {
    const markdown = `\`\`\`mermaid
\`\`\`
`;
    const html = await compile(markdown);

    // empty blocks should be kept as-is (not transformed)
    expect(html).not.toContain('mermaid-container');
  });

  it('handles multiple mermaid diagrams', async () => {
    const markdown = `\`\`\`mermaid
flowchart TD
    A --> B
\`\`\`

\`\`\`mermaid
sequenceDiagram
    Alice->>Bob: Hello
\`\`\`
`;
    const html = await compile(markdown);

    // count mermaid containers
    const containerMatches = html.match(/mermaid-container/g);
    expect(containerMatches).toHaveLength(2);

    // each should have unique IDs
    const idMatches = html.match(/data-mermaid-id="([^"]+)"/g);
    expect(idMatches).toHaveLength(2);
    expect(idMatches![0]).not.toBe(idMatches![1]);
  });

  it('includes placeholder container with mermaid data in output', async () => {
    const markdown = `\`\`\`mermaid
pie title Test
    "A" : 50
    "B" : 50
\`\`\`
`;
    const html = await compile(markdown);

    // server-side plugin creates placeholder container w/ data attributes
    // client-side MermaidRenderer component handles loading state & rendering
    expect(html).toContain('mermaid-container');
    expect(html).toContain('data-mermaid-chart');
    expect(html).toContain('pie title Test');
  });
});
