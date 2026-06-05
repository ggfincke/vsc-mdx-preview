// tests/helpers/create-compiler-config.ts
// shared factory for library-native CompilerConfig in compile tests

import type { CompilerConfig } from 'mdx-forge/compiler';

export function createCompilerConfig(
  overrides: Partial<CompilerConfig> = {}
): CompilerConfig {
  return {
    documentPath: '/workspace/test.mdx',
    useHostMarkdownStyles: true,
    componentsBuiltins: true,
    componentsUnknownBehavior: 'placeholder',
    ...overrides,
  };
}
