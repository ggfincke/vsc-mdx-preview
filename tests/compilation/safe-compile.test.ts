// tests/compilation/safe-compile.test.ts
// unit tests for Safe Mode MDX compilation (MDX -> HTML) via mdx-tools/compiler

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { compileSafe } from 'mdx-tools/compiler';
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

describe('compileSafe()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('compiles basic MDX to HTML', async () => {
    const result = await compileSafe(FIXTURES.basicMdx, createConfig());

    expect(result.html).toContain('<h1');
    expect(result.html).toContain('Hello');
    expect(result.html).toContain('<p');
    expect(result.html).toContain('World');
  });

  it('extracts frontmatter and returns it separately', async () => {
    const result = await compileSafe(
      FIXTURES.mdxWithFrontmatter,
      createConfig()
    );

    expect(result.frontmatter).toBeDefined();
    expect(result.frontmatter.title).toBe('Test Document');
    expect(result.frontmatter.author).toBe('Test Author');
    // frontmatter should not appear in HTML
    expect(result.html).not.toContain('Test Document');
    expect(result.html).not.toContain('author:');
  });

  it('creates placeholder for unknown JSX components (default behavior)', async () => {
    const result = await compileSafe(FIXTURES.mdxWithJsx, createConfig());

    expect(result.html).toContain('mdx-unknown-component-placeholder');
    expect(result.html).toContain('CustomComponent');
  });

  it('strips unknown components when unknownBehavior is "strip"', async () => {
    const result = await compileSafe(
      FIXTURES.mdxWithJsx,
      createConfig({ componentsUnknownBehavior: 'strip' })
    );

    expect(result.html).not.toContain('CustomComponent');
    expect(result.html).not.toContain('mdx-unknown-component');
  });

  it('replaces JSX expressions with placeholder', async () => {
    const result = await compileSafe(
      FIXTURES.mdxWithExpression,
      createConfig()
    );

    expect(result.html).toContain('mdx-expression-placeholder');
    expect(result.html).toContain('{...}');
    // should not evaluate the expression
    expect(result.html).not.toContain('42');
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

  it('converts PlantUML code blocks into placeholders', async () => {
    const result = await compileSafe(
      `\`\`\`plantuml
@startuml
Alice -> Bob: Hi
@enduml
\`\`\``,
      createConfig()
    );

    expect(result.html).toContain('plantuml-container');
    expect(result.html).toContain('data-plantuml-code');
  });

  it('converts Graphviz code blocks into placeholders', async () => {
    const result = await compileSafe(
      `\`\`\`dot
digraph G { A -> B }
\`\`\``,
      createConfig()
    );

    expect(result.html).toContain('graphviz-container');
    expect(result.html).toContain('data-graphviz-code');
  });

  it('returns empty frontmatter when none present', async () => {
    const result = await compileSafe(FIXTURES.basicMdx, createConfig());

    expect(result.frontmatter).toEqual({});
  });
});
