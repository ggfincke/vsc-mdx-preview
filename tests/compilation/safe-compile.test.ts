// tests/compilation/safe-compile.test.ts
// consumer smoke tests for Safe Mode MDX compilation via mdx-forge/compiler
// canonical tests live in mdx-forge — these verify the integration boundary

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { compileSafe } from 'mdx-forge/compiler';
import { FIXTURES, createCompilerConfig } from '../helpers';

describe('compileSafe() [consumer smoke]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('compiles basic MDX to HTML', async () => {
    const result = await compileSafe(FIXTURES.basicMdx, createCompilerConfig());

    expect(result.html).toContain('<h1');
    expect(result.html).toContain('Hello');
    expect(result.html).toContain('<p');
    expect(result.html).toContain('World');
  });

  it('extracts frontmatter and returns it separately', async () => {
    const result = await compileSafe(
      FIXTURES.mdxWithFrontmatter,
      createCompilerConfig()
    );

    expect(result.frontmatter).toBeDefined();
    expect(result.frontmatter.title).toBe('Test Document');
    expect(result.frontmatter.author).toBe('Test Author');
    // frontmatter should not appear in HTML
    expect(result.html).not.toContain('Test Document');
    expect(result.html).not.toContain('author:');
  });

  it('creates placeholder for unknown JSX components (default behavior)', async () => {
    const result = await compileSafe(FIXTURES.mdxWithJsx, createCompilerConfig());

    expect(result.html).toContain('mdx-unknown-component-placeholder');
    expect(result.html).toContain('CustomComponent');
  });
});
