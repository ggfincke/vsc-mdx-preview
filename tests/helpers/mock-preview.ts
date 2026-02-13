// tests/helpers/mock-preview.ts
// factory for creating mock Preview objects for tests

import { vi } from 'vitest';
import type { MockDocument } from './mock-document';
import { createMockDocument } from './mock-document';

// minimal configuration state needed by compile functions
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

// minimal Preview interface needed by compile functions
export interface MockPreview {
  doc: MockDocument;
  fsPath: string;
  entryFsDirectory: string | null;
  dependentFsPaths: Set<string>;
  configuration: MockConfigurationState;
  mdxPreviewConfig: MockResolvedConfig | undefined;
  typescriptConfiguration: MockTypeScriptConfig | undefined;
  // optional lifecycle & webview fields (present when tests need them)
  active?: boolean;
  refreshWebview?: ReturnType<typeof vi.fn>;
  dispose?: ReturnType<typeof vi.fn>;
  pushThemeState?: ReturnType<typeof vi.fn>;
  clearAllCaches?: ReturnType<typeof vi.fn>;
  completeHandshake?: ReturnType<typeof vi.fn>;
  evaluationDuration?: number;
  isTailwindRequestCurrent?: ReturnType<typeof vi.fn>;
  updateTailwindWatchFiles?: ReturnType<typeof vi.fn>;
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
  // optional lifecycle & webview fields
  active?: boolean;
  refreshWebview?: ReturnType<typeof vi.fn>;
  dispose?: ReturnType<typeof vi.fn>;
  pushThemeState?: ReturnType<typeof vi.fn>;
  clearAllCaches?: ReturnType<typeof vi.fn>;
  completeHandshake?: ReturnType<typeof vi.fn>;
  evaluationDuration?: number;
  isTailwindRequestCurrent?: ReturnType<typeof vi.fn>;
  updateTailwindWatchFiles?: ReturnType<typeof vi.fn>;
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
    active,
    refreshWebview,
    dispose,
    pushThemeState,
    clearAllCaches,
    completeHandshake,
    evaluationDuration,
    isTailwindRequestCurrent,
    updateTailwindWatchFiles,
  } = options;

  const doc = createMockDocument(content, { fsPath, languageId });

  const preview: MockPreview = {
    doc,
    fsPath,
    entryFsDirectory: fsPath.substring(0, fsPath.lastIndexOf('/')),
    dependentFsPaths: new Set<string>(),
    configuration: { ...DEFAULT_CONFIGURATION, ...configuration },
    mdxPreviewConfig,
    typescriptConfiguration,
  };

  // attach optional fields only when provided
  if (active !== undefined) {
    preview.active = active;
  }
  if (refreshWebview) {
    preview.refreshWebview = refreshWebview;
  }
  if (dispose) {
    preview.dispose = dispose;
  }
  if (pushThemeState) {
    preview.pushThemeState = pushThemeState;
  }
  if (clearAllCaches) {
    preview.clearAllCaches = clearAllCaches;
  }
  if (completeHandshake) {
    preview.completeHandshake = completeHandshake;
  }
  if (evaluationDuration !== undefined) {
    preview.evaluationDuration = evaluationDuration;
  }
  if (isTailwindRequestCurrent) {
    preview.isTailwindRequestCurrent = isTailwindRequestCurrent;
  }
  if (updateTailwindWatchFiles) {
    preview.updateTailwindWatchFiles = updateTailwindWatchFiles;
  }

  return preview;
}
