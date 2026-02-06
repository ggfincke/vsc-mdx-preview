// tests/helpers/mock-compiler-config.ts
// factory helpers for CompilerConfig test inputs

import type { UnknownBehaviorValue } from '@mdx-preview/shared';
import type {
  CompilerConfig,
  ResolvedConfig,
} from '../../packages/extension/types';
import type { MockPreview } from './mock-preview';

type CompilerConfigOverrides = Partial<CompilerConfig>;

function createMockUri(fsPath: string): CompilerConfig['docUri'] {
  return {
    scheme: 'file',
    fsPath,
    path: fsPath,
    toString: () => `file://${fsPath}`,
  } as CompilerConfig['docUri'];
}

// create a default CompilerConfig w/ optional overrides
export function createMockCompilerConfig(
  overrides: CompilerConfigOverrides = {}
): CompilerConfig {
  const docFsPath = overrides.docFsPath ?? '/workspace/test.mdx';

  return {
    docUri: overrides.docUri ?? createMockUri(docFsPath),
    docFsPath,
    customLayoutFilePath: overrides.customLayoutFilePath ?? '',
    useVscodeMarkdownStyles: overrides.useVscodeMarkdownStyles ?? true,
    useWhiteBackground: overrides.useWhiteBackground ?? false,
    componentsBuiltins: overrides.componentsBuiltins ?? true,
    componentsUnknownBehavior:
      overrides.componentsUnknownBehavior ??
      ('placeholder' as UnknownBehaviorValue),
    configFile: overrides.configFile ?? null,
  };
}

// project Preview test state to CompilerConfig
export function createMockCompilerConfigFromPreview(
  preview: MockPreview,
  overrides: CompilerConfigOverrides = {}
): CompilerConfig {
  const previewConfigFile =
    (preview.mdxPreviewConfig as unknown as ResolvedConfig | undefined) ?? null;

  return createMockCompilerConfig({
    docUri: preview.doc.uri as CompilerConfig['docUri'],
    docFsPath: preview.fsPath,
    customLayoutFilePath: preview.configuration.customLayoutFilePath,
    useVscodeMarkdownStyles: preview.configuration.useVscodeMarkdownStyles,
    useWhiteBackground: preview.configuration.useWhiteBackground,
    configFile: previewConfigFile,
    ...overrides,
  });
}
