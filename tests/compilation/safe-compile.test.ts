// tests/compilation/safe-compile.test.ts
// Unit tests for Safe Mode MDX compilation (MDX -> HTML)

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode
vi.mock('vscode', () => ({}));

// Mock logging
vi.mock('../../packages/extension-host/src/shared/logging/logger', () => ({
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  createTaggedLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

// Import after mocks
import { compileSafe } from '../../packages/extension-host/src/features/compilation/safe/compile';
import { FIXTURES, createMockCompilerConfig } from '../helpers';

describe('compileSafe()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('compiles basic MDX to HTML', async () => {
    const result = await compileSafe(
      FIXTURES.basicMdx,
      createMockCompilerConfig()
    );

    expect(result.html).toContain('<h1');
    expect(result.html).toContain('Hello');
    expect(result.html).toContain('<p');
    expect(result.html).toContain('World');
  });

  it('extracts frontmatter and returns it separately', async () => {
    const result = await compileSafe(
      FIXTURES.mdxWithFrontmatter,
      createMockCompilerConfig()
    );

    expect(result.frontmatter).toBeDefined();
    expect(result.frontmatter.title).toBe('Test Document');
    expect(result.frontmatter.author).toBe('Test Author');
    // Frontmatter should not appear in HTML
    expect(result.html).not.toContain('Test Document');
    expect(result.html).not.toContain('author:');
  });

  it('creates placeholder for unknown JSX components (default behavior)', async () => {
    const result = await compileSafe(
      FIXTURES.mdxWithJsx,
      createMockCompilerConfig()
    );

    expect(result.html).toContain('mdx-unknown-component-placeholder');
    expect(result.html).toContain('CustomComponent');
  });

  it('strips unknown components when unknownBehavior is "strip"', async () => {
    const result = await compileSafe(
      FIXTURES.mdxWithJsx,
      createMockCompilerConfig({ componentsUnknownBehavior: 'strip' })
    );

    expect(result.html).not.toContain('CustomComponent');
    expect(result.html).not.toContain('mdx-unknown-component');
  });

  it('replaces JSX expressions with placeholder', async () => {
    const result = await compileSafe(
      FIXTURES.mdxWithExpression,
      createMockCompilerConfig()
    );

    expect(result.html).toContain('mdx-expression-placeholder');
    expect(result.html).toContain('{...}');
    // Should not evaluate the expression
    expect(result.html).not.toContain('42');
  });

  it('handles code blocks correctly', async () => {
    const result = await compileSafe(
      FIXTURES.mdxWithCodeBlock,
      createMockCompilerConfig()
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
      createMockCompilerConfig()
    );

    expect(result.html).toContain('plantuml-container');
    expect(result.html).toContain('data-plantuml-code');
  });

  it('converts Graphviz code blocks into placeholders', async () => {
    const result = await compileSafe(
      `\`\`\`dot
digraph G { A -> B }
\`\`\``,
      createMockCompilerConfig()
    );

    expect(result.html).toContain('graphviz-container');
    expect(result.html).toContain('data-graphviz-code');
  });

  it('returns empty frontmatter when none present', async () => {
    const result = await compileSafe(
      FIXTURES.basicMdx,
      createMockCompilerConfig()
    );

    expect(result.frontmatter).toEqual({});
  });
});
