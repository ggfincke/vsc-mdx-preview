// tests/helpers/mock-preview.ts
// Factory for creating mock Preview objects for tests

import type { MockDocument } from './mock-document';
import { createMockDocument } from './mock-document';

// Minimal configuration state needed by compile functions
export interface MockConfigurationState {
  updateMode: 'onChange' | 'onSave';
  debounceDelay: number;
  useVscodeMarkdownStyles: boolean;
  useWhiteBackground: boolean;
  customLayoutFilePath: string;
  customCss: string;
  useSucraseTranspiler: boolean;
  securityPolicy: 'strict' | 'disabled';
  tailwindEnabled: 'auto' | 'enabled' | 'disabled';
}

// Minimal Preview interface needed by compile functions
export interface MockPreview {
  doc: MockDocument;
  fsPath: string;
  entryFsDirectory: string | null;
  dependentFsPaths: Set<string>;
  configuration: MockConfigurationState;
  mdxPreviewConfig: MockResolvedConfig | undefined;
  typescriptConfiguration: MockTypeScriptConfig | undefined;
}

export interface MockResolvedConfig {
  configPath: string;
  config: {
    plugins?: {
      remark?: string[];
      rehype?: string[];
    };
    components?: Record<string, string>;
    unknownBehavior?: 'strip' | 'placeholder' | 'raw';
  };
}

export interface MockTypeScriptConfig {
  configPath: string;
  paths?: Record<string, string[]>;
  baseUrl?: string;
}

export interface MockPreviewOptions {
  content?: string;
  fsPath?: string;
  languageId?: string;
  configuration?: Partial<MockConfigurationState>;
  mdxPreviewConfig?: MockResolvedConfig;
  typescriptConfiguration?: MockTypeScriptConfig;
}

const DEFAULT_CONFIGURATION: MockConfigurationState = {
  updateMode: 'onChange',
  debounceDelay: 300,
  useVscodeMarkdownStyles: true,
  useWhiteBackground: false,
  customLayoutFilePath: '',
  customCss: '',
  useSucraseTranspiler: false,
  securityPolicy: 'strict',
  tailwindEnabled: 'auto',
};

export function createMockPreview(
  options: MockPreviewOptions = {}
): MockPreview {
  const {
    content = '# Test',
    fsPath = '/workspace/test.mdx',
    languageId = 'mdx',
    configuration = {},
    mdxPreviewConfig,
    typescriptConfiguration,
  } = options;

  const doc = createMockDocument(content, { fsPath, languageId });

  return {
    doc,
    fsPath,
    entryFsDirectory: fsPath.substring(0, fsPath.lastIndexOf('/')),
    dependentFsPaths: new Set<string>(),
    configuration: { ...DEFAULT_CONFIGURATION, ...configuration },
    mdxPreviewConfig,
    typescriptConfiguration,
  };
}
