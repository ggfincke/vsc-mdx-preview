// tests/compilation/trusted-compile.test.ts
// consumer smoke tests for Trusted Mode MDX compilation via mdx-forge/compiler
// canonical tests live in mdx-forge — these verify the integration boundary

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { compileTrusted } from 'mdx-forge/compiler';
import type { CompilerConfig } from 'mdx-forge/compiler';
import { FIXTURES } from '../helpers';

// create library-native CompilerConfig
function createConfig(overrides: Partial<CompilerConfig> = {}): CompilerConfig {
  return {
    documentPath: '/workspace/test.mdx',
    useHostMarkdownStyles: true,
    componentsBuiltins: true,
    componentsUnknownBehavior: 'placeholder',
    ...overrides,
  };
}

describe('compileTrusted() [consumer smoke]', () => {
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

  it('injects vscode-markdown-layout when no default export and useHostMarkdownStyles is true', async () => {
    const result = await compileTrusted(
      FIXTURES.basicMdx,
      true,
      createConfig({ useHostMarkdownStyles: true })
    );

    expect(result.code).toContain('vscode-markdown-layout');
    expect(result.code).toContain('createLayout');
  });
});
