// tests/compilation/trusted-compile.test.ts
// unit tests for Trusted Mode MDX compilation (MDX -> JavaScript) via mdx-tools/compiler

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { compileTrusted } from 'mdx-tools/compiler';
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

describe('compileTrusted()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('compiles basic MDX to JavaScript with React imports', async () => {
    const result = await compileTrusted(
      FIXTURES.basicMdx,
      true,
      createConfig()
    );

    expect(result.code).toContain('import React from');
    expect(result.code).toContain('MDXContent');
    expect(result.code).toContain('export default');
  });

  it('extracts frontmatter and returns it separately', async () => {
    const result = await compileTrusted(
      FIXTURES.mdxWithFrontmatter,
      true,
      createConfig()
    );

    expect(result.frontmatter).toBeDefined();
    expect(result.frontmatter.title).toBe('Test Document');
    expect(result.frontmatter.author).toBe('Test Author');
  });

  it('injects vscode-markdown-layout when no default export and useVscodeMarkdownStyles is true', async () => {
    const result = await compileTrusted(
      FIXTURES.basicMdx,
      true,
      createConfig({ useVscodeMarkdownStyles: true })
    );

    expect(result.code).toContain('vscode-markdown-layout');
    expect(result.code).toContain('createLayout');
  });

  it('preserves existing default export (no layout injection)', async () => {
    const result = await compileTrusted(
      FIXTURES.mdxWithLayout,
      true,
      createConfig({ useVscodeMarkdownStyles: true })
    );

    // should NOT inject vscode-markdown-layout when there's already a default export
    expect(result.code).not.toContain('vscode-markdown-layout');
  });

  it('returns empty frontmatter when none present', async () => {
    const result = await compileTrusted(
      FIXTURES.basicMdx,
      true,
      createConfig()
    );

    expect(result.frontmatter).toEqual({});
  });
});
