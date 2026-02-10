// tests/extension/commands/config-info.test.ts
// unit tests for effective configuration inspection command

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';

const {
  mockResolveConfig,
  mockBuildEffectivePreviewConfig,
  mockExtractFrontmatter,
  mockConfigManager,
  mockFrameworkDetector,
  mockTrustManager,
  mockErrorReporter,
} = vi.hoisted(() => ({
  mockResolveConfig: vi.fn(),
  mockBuildEffectivePreviewConfig: vi.fn(),
  mockExtractFrontmatter: vi.fn(),
  mockConfigManager: {
    inspect: vi.fn(),
  },
  mockFrameworkDetector: {
    getFramework: vi.fn(),
  },
  mockTrustManager: {
    getStateForDocument: vi.fn(),
  },
  mockErrorReporter: {
    reportToUser: vi.fn(),
  },
}));

vi.mock('../../../packages/extension-host/src/shared/logging/logger', () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  createTaggedLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock(
  '../../../packages/extension-host/src/features/preview/configuration/ConfigResolver',
  () => ({
    resolveConfig: (...args: any[]) => mockResolveConfig(...args),
  })
);

vi.mock(
  '../../../packages/extension-host/src/shared/config/EffectivePreviewConfig',
  () => ({
    buildEffectivePreviewConfig: (...args: any[]) =>
      mockBuildEffectivePreviewConfig(...args),
  })
);

vi.mock('mdx-tools/compiler', () => ({
  extractFrontmatter: (...args: any[]) => mockExtractFrontmatter(...args),
}));

vi.mock('../../../packages/extension-host/src/app/services', () => ({
  getConfigManager: () => mockConfigManager,
  getFrameworkDetector: () => mockFrameworkDetector,
  getTrustManager: () => mockTrustManager,
  getErrorReporter: () => mockErrorReporter,
}));

import { commands } from '../../../packages/extension-host/src/features/commands/config-info';

describe('config-info commands', () => {
  const handler = commands.find(
    (c) => c.id === 'mdx-preview.commands.showEffectiveConfig'
  )!.handler;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfigManager.inspect.mockReturnValue({});
    mockExtractFrontmatter.mockReturnValue({
      frontmatter: { previewTheme: 'github-dark' },
    });
    mockResolveConfig.mockReturnValue({
      configPath: '/workspace/.mdx-previewrc.json',
      configDir: '/workspace',
      config: {
        framework: 'docusaurus',
        tailwind: { enabled: 'enabled' },
        components: { Callout: './Callout.tsx' },
        remarkPlugins: ['remark-gfm'],
      },
    });
    mockBuildEffectivePreviewConfig.mockReturnValue({
      updateMode: 'onType',
      debounceDelay: 300,
      enableScripts: true,
      openMdxLinksInPreview: true,
      securityPolicy: 'strict',
      useVscodeMarkdownStyles: true,
      useWhiteBackground: false,
      customCss: '',
      customLayoutFilePath: '',
      useSucraseTranspiler: false,
      previewTheme: 'github-dark',
      codeBlockTheme: 'auto',
      autoTheme: true,
      plantUmlServer: 'https://kroki.io',
      tailwind: { enabled: 'enabled' },
      framework: 'docusaurus',
      frameworkComponentShims: true,
      componentsBuiltins: true,
      componentsUnknownBehavior: 'placeholder',
      remarkPlugins: ['remark-gfm'],
      rehypePlugins: [],
      components: { Callout: './Callout.tsx' },
    });
    mockFrameworkDetector.getFramework.mockReturnValue({
      framework: 'docusaurus',
      detected: true,
      version: '3.0.0',
    });
    mockTrustManager.getStateForDocument.mockReturnValue({
      workspaceTrusted: true,
      scriptsEnabled: true,
      canExecute: true,
      reason: undefined,
    });
  });

  it('shows warning when there is no active editor', async () => {
    (vscode.window as any).activeTextEditor = undefined;
    const warningSpy = vi.spyOn(vscode.window, 'showWarningMessage');

    await handler();

    expect(warningSpy).toHaveBeenCalledWith(
      expect.stringContaining('No active editor')
    );
  });

  it('shows warning when active document is not markdown/mdx', async () => {
    (vscode.window as any).activeTextEditor = {
      document: {
        languageId: 'typescript',
        uri: vscode.Uri.file('/workspace/file.ts'),
        getText: () => 'const x = 1',
      },
    };
    const warningSpy = vi.spyOn(vscode.window, 'showWarningMessage');

    await handler();

    expect(warningSpy).toHaveBeenCalledWith(
      expect.stringContaining('not an MDX or Markdown')
    );
  });

  it('opens formatted effective config JSON in side editor', async () => {
    (vscode.window as any).activeTextEditor = {
      document: {
        languageId: 'mdx',
        uri: vscode.Uri.file('/workspace/doc.mdx'),
        getText: () => '---\npreviewTheme: github-dark\n---\n# Doc',
      },
    };

    const openSpy = vi
      .spyOn(vscode.workspace, 'openTextDocument')
      .mockResolvedValue({
        uri: vscode.Uri.parse('untitled://effective-config.json'),
        languageId: 'json',
        fileName: 'effective-config.json',
        getText: () => '',
      } as any);
    const showSpy = vi
      .spyOn(vscode.window, 'showTextDocument')
      .mockResolvedValue(undefined as any);

    await handler();

    expect(openSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        language: 'json',
        content: expect.any(String),
      })
    );
    const docArg = openSpy.mock.calls[0][0] as { content: string };
    const parsed = JSON.parse(docArg.content);
    expect(parsed.metadata.documentPath).toBe('/workspace/doc.mdx');
    expect(parsed.metadata.framework).toBe('docusaurus');
    expect(parsed.sources['preview.previewTheme'].source).toBe('frontmatter');
    expect(showSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        viewColumn: vscode.ViewColumn.Beside,
        preview: true,
      })
    );
  });

  it('reports user-facing error when config generation fails', async () => {
    (vscode.window as any).activeTextEditor = {
      document: {
        languageId: 'mdx',
        uri: vscode.Uri.file('/workspace/doc.mdx'),
        getText: () => '# Doc',
      },
    };
    mockBuildEffectivePreviewConfig.mockImplementation(() => {
      throw new Error('effective-config failed');
    });

    await handler();

    expect(mockErrorReporter.reportToUser).toHaveBeenCalledWith(
      expect.any(Error),
      expect.anything()
    );
  });
});
