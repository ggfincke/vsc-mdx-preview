// tests/compilation/trusted-compile.test.ts
// consumer smoke tests for Trusted Mode MDX compilation via mdx-forge/compiler
// canonical tests live in mdx-forge — these verify the integration boundary

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { compileTrusted } from 'mdx-forge/compiler';
import { FIXTURES, createCompilerConfig } from '../helpers';

describe('compileTrusted() [consumer smoke]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('compiles basic MDX to JavaScript with React imports', async () => {
    const result = await compileTrusted(
      FIXTURES.basicMdx,
      true,
      createCompilerConfig()
    );

    expect(result.code).toContain('import React from');
    expect(result.code).toContain('MDXContent');
    expect(result.code).toContain('export default');
  });

  it('injects vscode-markdown-layout when no default export and useHostMarkdownStyles is true', async () => {
    const result = await compileTrusted(
      FIXTURES.basicMdx,
      true,
      createCompilerConfig({ useHostMarkdownStyles: true })
    );

    expect(result.code).toContain('vscode-markdown-layout');
    expect(result.code).toContain('createLayout');
  });
});
