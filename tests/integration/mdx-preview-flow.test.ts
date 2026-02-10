// tests/integration/mdx-preview-flow.test.ts
// end-to-end tests for MDX compilation & preview flow via mdx-tools/compiler

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { compileTrusted, compileSafe } from 'mdx-tools/compiler';
import type { CompilerConfig } from 'mdx-tools/compiler';
import { FIXTURES } from '../helpers';

// create library-native CompilerConfig
function createConfig(
  overrides: Partial<CompilerConfig> = {}
): CompilerConfig {
  return {
    documentPath: '/workspace/test.mdx',
    useVscodeMarkdownStyles: true,
    componentsBuiltins: true,
    componentsUnknownBehavior: 'placeholder',
    ...overrides,
  };
}

describe('MDX → Preview Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Trusted Mode Compilation', () => {
    it('compiles basic MDX to executable JavaScript', async () => {
      const result = await compileTrusted(
        FIXTURES.basicMdx,
        true,
        createConfig()
      );

      // output should be valid JavaScript module
      expect(result.code).toContain('function MDXContent');
      expect(result.code).toContain('import React');
      // content should be preserved
      expect(result.code).toContain('Hello');
    });

    it('compiles MDX w/ JSX to JavaScript w/ React elements', async () => {
      const mdx = `# Hello

<div className="test">
  <span>Content</span>
</div>`;

      const result = await compileTrusted(mdx, true, createConfig());

      expect(result.code).toContain('function MDXContent');
      // JSX should be compiled to React.createElement calls (or jsx() calls)
      expect(result.code).toMatch(/jsx|createElement/);
    });

    it('extracts frontmatter correctly', async () => {
      const result = await compileTrusted(
        FIXTURES.mdxWithFrontmatter,
        true,
        createConfig()
      );

      expect(result.frontmatter).toBeDefined();
      expect(result.frontmatter.title).toBe('Test Document');
      expect(result.frontmatter.author).toBe('Test Author');
      // frontmatter should not appear in code
      expect(result.code).not.toContain('title: Test Document');
    });

    it('handles code blocks w/ syntax highlighting', async () => {
      const result = await compileTrusted(
        FIXTURES.mdxWithCodeBlock,
        true,
        createConfig()
      );

      expect(result.code).toContain('function MDXContent');
      // code content should be in the output
      expect(result.code).toContain('const');
    });

    it('handles MDX w/ default export (layout)', async () => {
      const result = await compileTrusted(
        FIXTURES.mdxWithLayout,
        true,
        createConfig()
      );

      // should have MDXContent function
      expect(result.code).toContain('MDXContent');
      // layout export should be preserved
      expect(result.code).toContain('Layout');
    });

    it('handles GFM syntax (tables, task lists)', async () => {
      const mdx = `# GFM Test

| Column 1 | Column 2 |
|----------|----------|
| A        | B        |

- [x] Completed task
- [ ] Incomplete task`;

      const result = await compileTrusted(mdx, true, createConfig());

      expect(result.code).toContain('function MDXContent');
    });

    it('handles math expressions', async () => {
      const mdx = `# Math Test

Inline math: $E = mc^2$

Block math:

$$
\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}
$$`;

      const result = await compileTrusted(mdx, true, createConfig());

      expect(result.code).toContain('function MDXContent');
    });

    it('handles mermaid diagrams', async () => {
      const mdx = `# Mermaid Test

\`\`\`mermaid
graph TD
    A --> B
\`\`\``;

      const result = await compileTrusted(mdx, true, createConfig());

      expect(result.code).toContain('function MDXContent');
      // mermaid code block should be in output
      expect(result.code).toContain('mermaid');
    });

    it('handles PlantUML diagrams', async () => {
      const mdx = `# PlantUML Test

\`\`\`plantuml
@startuml
Alice -> Bob: Hello
@enduml
\`\`\``;

      const result = await compileTrusted(mdx, true, createConfig());

      expect(result.code).toContain('plantuml-container');
      expect(result.code).toContain('data-plantuml-code');
    });

    it('handles Graphviz diagrams', async () => {
      const mdx = `# Graphviz Test

\`\`\`dot
digraph G {
  A -> B
}
\`\`\``;

      const result = await compileTrusted(mdx, true, createConfig());

      expect(result.code).toContain('graphviz-container');
      expect(result.code).toContain('data-graphviz-code');
    });

    it('injects VS Code markdown styles when configured', async () => {
      const result = await compileTrusted(
        FIXTURES.basicMdx,
        true,
        createConfig({ useVscodeMarkdownStyles: true })
      );

      // should import vscode-markdown-layout
      expect(result.code).toContain('vscode-markdown-layout');
    });

    it('does not inject layout when useVscodeMarkdownStyles is false', async () => {
      const result = await compileTrusted(
        FIXTURES.basicMdx,
        true,
        createConfig({ useVscodeMarkdownStyles: false })
      );

      expect(result.code).not.toContain('vscode-markdown-layout');
    });
  });

  describe('Safe Mode Compilation', () => {
    it('compiles basic MDX to sanitized HTML', async () => {
      const result = await compileSafe(FIXTURES.basicMdx, createConfig());

      expect(result.html).toContain('<h1');
      expect(result.html).toContain('Hello');
      expect(result.html).toContain('<p');
      expect(result.html).toContain('World');
    });

    it('extracts frontmatter correctly', async () => {
      const result = await compileSafe(
        FIXTURES.mdxWithFrontmatter,
        createConfig()
      );

      expect(result.frontmatter).toBeDefined();
      expect(result.frontmatter.title).toBe('Test Document');
      expect(result.frontmatter.author).toBe('Test Author');
      // frontmatter should not appear in HTML
      expect(result.html).not.toContain('Test Document');
    });

    it('creates placeholder for unknown JSX components', async () => {
      const result = await compileSafe(FIXTURES.mdxWithJsx, createConfig());

      expect(result.html).toContain('mdx-unknown-component-placeholder');
      expect(result.html).toContain('CustomComponent');
    });

    it('strips unknown components when configured', async () => {
      const result = await compileSafe(
        FIXTURES.mdxWithJsx,
        createConfig({ componentsUnknownBehavior: 'strip' })
      );

      expect(result.html).not.toContain('CustomComponent');
      expect(result.html).not.toContain('mdx-unknown-component');
    });

    it('keeps children w/ raw behavior', async () => {
      const result = await compileSafe(
        FIXTURES.mdxWithJsx,
        createConfig({ componentsUnknownBehavior: 'raw' })
      );

      // children should be preserved, wrapper removed
      expect(result.html).toContain('Child content');
      expect(result.html).not.toContain('mdx-unknown-component');
    });

    it('replaces JS expressions w/ placeholder', async () => {
      const result = await compileSafe(
        FIXTURES.mdxWithExpression,
        createConfig()
      );

      expect(result.html).toContain('mdx-expression-placeholder');
      expect(result.html).toContain('{...}');
      // expression should NOT be evaluated
      expect(result.html).not.toContain('42');
    });

    it('removes import/export statements', async () => {
      const result = await compileSafe(
        FIXTURES.mdxWithImports,
        createConfig()
      );

      // imports should be removed
      expect(result.html).not.toContain('import');
      // content should remain
      expect(result.html).toContain('Hello');
    });

    it('handles code blocks correctly', async () => {
      const result = await compileSafe(
        FIXTURES.mdxWithCodeBlock,
        createConfig()
      );

      expect(result.html).toContain('<pre');
      expect(result.html).toContain('<code');
      expect(result.html).toContain('const');
    });

    it('handles GFM tables', async () => {
      const mdx = `| A | B |
|---|---|
| 1 | 2 |`;

      const result = await compileSafe(mdx, createConfig());

      expect(result.html).toContain('<table');
      expect(result.html).toContain('<tr');
      expect(result.html).toContain('<td');
    });

    it('handles math expressions', async () => {
      const mdx = `$E = mc^2$`;

      const result = await compileSafe(mdx, createConfig());

      // math should be rendered to HTML (KaTeX)
      expect(result.html).toContain('katex');
    });

    it('handles PlantUML diagrams', async () => {
      const mdx = `# PlantUML

\`\`\`plantuml
@startuml
Alice -> Bob: Test
@enduml
\`\`\``;

      const result = await compileSafe(mdx, createConfig());

      expect(result.html).toContain('plantuml-container');
      expect(result.html).toContain('data-plantuml-code');
    });

    it('handles Graphviz diagrams', async () => {
      const mdx = `# Graphviz

\`\`\`graphviz
digraph G {
  A -> B
}
\`\`\``;

      const result = await compileSafe(mdx, createConfig());

      expect(result.html).toContain('graphviz-container');
      expect(result.html).toContain('data-graphviz-code');
    });

    it('returns empty frontmatter when none present', async () => {
      const result = await compileSafe(FIXTURES.basicMdx, createConfig());

      expect(result.frontmatter).toEqual({});
    });

    it('handles inline JSX elements', async () => {
      const result = await compileSafe(
        FIXTURES.mdxWithInlineJsx,
        createConfig()
      );

      expect(result.html).toContain('mdx-jsx-placeholder');
      expect(result.html).toContain('InlineComponent');
    });
  });

  describe('Error Handling', () => {
    it('throws on invalid MDX syntax in Trusted Mode', async () => {
      await expect(
        compileTrusted(FIXTURES.invalidMdx, true, createConfig())
      ).rejects.toThrow();
    });

    it('throws on invalid MDX syntax in Safe Mode', async () => {
      await expect(
        compileSafe(FIXTURES.invalidMdx, createConfig())
      ).rejects.toThrow();
    });
  });

  describe('Framework Component Handling', () => {
    it('compiles Docusaurus-style imports in Trusted Mode', async () => {
      const result = await compileTrusted(
        FIXTURES.docusaurusTabs,
        true,
        createConfig()
      );

      // should compile successfully (imports may be transformed)
      expect(result.code).toContain('function MDXContent');
    });

    it('handles Docusaurus components in Safe Mode', async () => {
      const result = await compileSafe(
        FIXTURES.docusaurusTabs,
        createConfig()
      );

      // components should be replaced w/ placeholders
      expect(result.html).toBeDefined();
    });

    it('compiles Nextra-style imports in Trusted Mode', async () => {
      const result = await compileTrusted(
        FIXTURES.nextraCallout,
        true,
        createConfig()
      );

      expect(result.code).toContain('function MDXContent');
    });
  });

  describe('Builtin Components', () => {
    it('handles generic Callout component in Safe Mode', async () => {
      const mdx = `<Callout type="info">
  Important information
</Callout>`;

      const result = await compileSafe(mdx, createConfig());

      // Callout should be transformed to semantic HTML
      expect(result.html).toContain('callout');
      expect(result.html).toContain('Important information');
    });

    it('skips builtin transformation when builtins disabled', async () => {
      const mdx = `<Callout type="info">
  Info text
</Callout>`;

      const result = await compileSafe(
        mdx,
        createConfig({ componentsBuiltins: false })
      );

      // Callout should be treated as unknown component
      expect(result.html).toContain('mdx-unknown-component-placeholder');
    });
  });

  describe('Content Preservation', () => {
    it('preserves text content through Trusted compilation', async () => {
      const mdx = `# Title

This is paragraph text with **bold** and *italic*.

- List item 1
- List item 2`;

      const result = await compileTrusted(mdx, true, createConfig());

      expect(result.code).toContain('Title');
      expect(result.code).toContain('paragraph text');
      expect(result.code).toContain('bold');
      expect(result.code).toContain('List item');
    });

    it('preserves text content through Safe compilation', async () => {
      const mdx = `# Title

This is paragraph text with **bold** and *italic*.

- List item 1
- List item 2`;

      const result = await compileSafe(mdx, createConfig());

      expect(result.html).toContain('Title');
      expect(result.html).toContain('paragraph text');
      expect(result.html).toContain('<strong>bold</strong>');
      expect(result.html).toContain('<em>italic</em>');
      expect(result.html).toContain('List item');
    });
  });
});
