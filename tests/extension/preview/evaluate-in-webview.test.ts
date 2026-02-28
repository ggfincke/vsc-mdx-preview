// tests/extension/preview/evaluate-in-webview.test.ts
// unit tests for Tailwind profile routing in evaluate-in-webview

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  mockTrustManager,
  mockTailwindProcessor,
  mockFrameworkDetector,
  mockErrorReporter,
} from '../../helpers/mock-services';
import type { PreviewRuntimeConfig } from '../../../packages/extension-host/src/types';

const {
  mockStatusBarMessage,
  mockEngine,
  mockBuildEffectivePreviewConfig,
  mockToCompilerConfig,
} = vi.hoisted(() => ({
  mockStatusBarMessage: vi.fn(),
  mockEngine: {
    evaluateTrusted: vi.fn(),
    evaluateSafe: vi.fn(),
    processTailwindAsync: vi.fn(),
  },
  mockBuildEffectivePreviewConfig: vi.fn(),
  mockToCompilerConfig: vi.fn(() => ({ some: 'compiler-config' })),
}));

vi.mock('vscode', () => ({
  window: {
    setStatusBarMessage: mockStatusBarMessage,
  },
  workspace: {
    getWorkspaceFolder: vi.fn(() => undefined),
  },
}));

vi.mock(
  '../../../packages/extension-host/src/features/preview/EvaluationEngine',
  () => ({
    getEvaluationEngine: () => mockEngine,
  })
);

vi.mock(
  '../../../packages/extension-host/src/shared/config/EffectivePreviewConfig',
  () => ({
    buildEffectivePreviewConfig: (...args: unknown[]) =>
      mockBuildEffectivePreviewConfig(...args),
    toCompilerConfig: (...args: unknown[]) => mockToCompilerConfig(...args),
  })
);

vi.mock(
  '../../../packages/extension-host/src/features/diagnostics/ComponentDetector',
  () => ({
    detectComponents: vi.fn(),
    getUsedGenericComponents: vi.fn(() => []),
  })
);

vi.mock(
  '../../../packages/extension-host/src/features/framework/nextra/MetaResolver',
  () => ({
    resolveNextraMeta: vi.fn(() => ({})),
    mergeNextraMeta: vi.fn(() => ({})),
  })
);

vi.mock('mdx-forge/compiler', () => ({
  extractNextraFrontmatter: vi.fn(() => ({})),
}));

import evaluateInWebview from '../../../packages/extension-host/src/features/preview/evaluate-in-webview';

type MockPreview = ReturnType<typeof createPreview>;

function createPreview(): {
  doc: { uri: { scheme: string; fsPath: string; toString: () => string } };
  webviewHandle: {
    setTailwindBrowserCss: ReturnType<typeof vi.fn>;
    setTailwindCss: ReturnType<typeof vi.fn>;
    setTrustState: ReturnType<typeof vi.fn>;
    setFramework: ReturnType<typeof vi.fn>;
    updatePreviewSafe: ReturnType<typeof vi.fn>;
    updatePreview: ReturnType<typeof vi.fn>;
    setUsedComponents: ReturnType<typeof vi.fn>;
    setNextraMeta: ReturnType<typeof vi.fn>;
    setFrontmatter: ReturnType<typeof vi.fn>;
    setShowToc: ReturnType<typeof vi.fn>;
    setSourceLineHighlight: ReturnType<typeof vi.fn>;
    setSourceLineHighlightColor: ReturnType<typeof vi.fn>;
    setShimSideRail: ReturnType<typeof vi.fn>;
  };
  runtimeConfiguration: PreviewRuntimeConfig;
  webviewHandshakePromise: Promise<void>;
  onWebviewReady: ReturnType<typeof vi.fn>;
  pushThemeState: ReturnType<typeof vi.fn>;
  setFrontmatterState: ReturnType<typeof vi.fn>;
  pushRuntimeConfiguration: ReturnType<typeof vi.fn>;
  updateDependencies: ReturnType<typeof vi.fn>;
  updateTailwindWatchFiles: ReturnType<typeof vi.fn>;
  nextTailwindRequestId: ReturnType<typeof vi.fn>;
  isTailwindRequestCurrent: ReturnType<typeof vi.fn>;
  markTailwindFallbackReason: ReturnType<typeof vi.fn>;
  clearTailwindFallbackReason: ReturnType<typeof vi.fn>;
  setTailwindBrowserRuntimeEnabled: ReturnType<typeof vi.fn>;
  refreshWebview: ReturnType<typeof vi.fn>;
  entryFsDirectory: string;
  mdxPreviewConfig: undefined;
} {
  const runtimeConfiguration: PreviewRuntimeConfig = {
    showFrontmatter: false,
    showToc: false,
    sourceLineHighlight: true,
    sourceLineHighlightColor: 'dependent',
    shimSideRail: true,
  };
  let currentFrontmatter: Record<string, unknown> = {};
  const setFrontmatterState = vi.fn((frontmatter?: Record<string, unknown>) => {
    currentFrontmatter =
      frontmatter && Object.keys(frontmatter).length > 0 ? frontmatter : {};
  });
  const webviewHandle = {
    setTailwindBrowserCss: vi.fn(),
    setTailwindCss: vi.fn(),
    setTrustState: vi.fn(),
    setFramework: vi.fn(),
    updatePreviewSafe: vi.fn(),
    updatePreview: vi.fn(),
    setUsedComponents: vi.fn(),
    setNextraMeta: vi.fn(),
    setFrontmatter: vi.fn(),
    setShowToc: vi.fn(),
    setSourceLineHighlight: vi.fn(),
    setSourceLineHighlightColor: vi.fn(),
    setShimSideRail: vi.fn(),
  };
  const pushRuntimeConfiguration = vi.fn(() => {
    webviewHandle.setShowToc(runtimeConfiguration.showToc);
    webviewHandle.setSourceLineHighlight(
      runtimeConfiguration.sourceLineHighlight
    );
    webviewHandle.setSourceLineHighlightColor(
      runtimeConfiguration.sourceLineHighlightColor
    );
    webviewHandle.setShimSideRail(runtimeConfiguration.shimSideRail);
    webviewHandle.setFrontmatter(
      runtimeConfiguration.showFrontmatter ? currentFrontmatter : {}
    );
  });

  const preview = {
    doc: {
      uri: {
        scheme: 'file',
        fsPath: '/workspace/doc.mdx',
        toString: () => 'file:///workspace/doc.mdx',
      },
    },
    webviewHandle,
    runtimeConfiguration,
    webviewHandshakePromise: Promise.resolve(),
    onWebviewReady: vi.fn(),
    pushThemeState: vi.fn(),
    setFrontmatterState,
    pushRuntimeConfiguration,
    updateDependencies: vi.fn(),
    updateTailwindWatchFiles: vi.fn(),
    nextTailwindRequestId: vi.fn(() => 1),
    isTailwindRequestCurrent: vi.fn(() => true),
    markTailwindFallbackReason: vi.fn(() => true),
    clearTailwindFallbackReason: vi.fn(),
    setTailwindBrowserRuntimeEnabled: vi.fn(() => false),
    refreshWebview: vi.fn(async () => {}),
    entryFsDirectory: '/workspace',
    mdxPreviewConfig: undefined,
  };

  return preview;
}

function mockTrustedState(): void {
  mockTrustManager.getStateForDocument.mockReturnValue({
    workspaceTrusted: true,
    scriptsEnabled: true,
    canExecute: true,
    openMdxLinksInPreview: true,
  });
}

function mockSafeState(): void {
  mockTrustManager.getStateForDocument.mockReturnValue({
    workspaceTrusted: true,
    scriptsEnabled: true,
    canExecute: false,
    openMdxLinksInPreview: true,
  });
}

function mockTailwindEnabledConfig(): void {
  mockBuildEffectivePreviewConfig.mockReturnValue({
    enableScripts: true,
    tailwind: {
      enabled: 'enabled',
      maxFileSizeBytes: 1024 * 1024,
      maxCssFilesToSearch: 50,
      cacheMaxEntries: 10,
      cacheTtlSeconds: 60,
      compilationTimeout: 1000,
    },
  });
}

describe('evaluate-in-webview Tailwind routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTailwindEnabledConfig();
    mockTailwindProcessor.detectProfile.mockResolvedValue({
      profile: 'browser',
      reason: 'inline classes only',
      workspaceRoot: '/workspace',
      configPath: null,
      entryCssPath: '/workspace/tailwind.css',
      hasTailwindInput: true,
      inlineTailwindStyles: [],
    });
    mockEngine.evaluateTrusted.mockResolvedValue({
      code: 'export default function Demo() { return null; }',
      entryFilePath: '/workspace/doc.mdx',
      dependencies: [],
      frontmatter: undefined,
    });
    mockEngine.evaluateSafe.mockResolvedValue({
      html: '<p>safe</p>',
      frontmatter: undefined,
    });
  });

  it('refreshes webview when browser runtime toggle changes', async () => {
    mockTrustedState();

    const preview = createPreview();
    preview.setTailwindBrowserRuntimeEnabled.mockReturnValue(true);
    mockTailwindProcessor.detectProfile.mockResolvedValue({
      profile: 'browser',
      reason: 'No tailwind.config.* or plugin directives detected',
      workspaceRoot: '/workspace',
      configPath: null,
      entryCssPath: '/workspace/tailwind.css',
      hasTailwindInput: true,
      inlineTailwindStyles: [],
    });

    await evaluateInWebview(
      preview as unknown as MockPreview,
      '# doc',
      '/workspace/doc.mdx'
    );

    expect(mockTailwindProcessor.detectProfile).toHaveBeenCalledTimes(1);
    expect(preview.setTailwindBrowserRuntimeEnabled).toHaveBeenCalledWith(true);
    expect(preview.refreshWebview).toHaveBeenCalledTimes(1);
    expect(preview.webviewHandle.setTrustState).not.toHaveBeenCalled();
    expect(mockEngine.evaluateTrusted).not.toHaveBeenCalled();
    expect(mockEngine.evaluateSafe).not.toHaveBeenCalled();
  });

  it('warns once for advanced profile in Safe Mode and clears Tailwind CSS channels', async () => {
    mockSafeState();

    const preview = createPreview();
    preview.markTailwindFallbackReason
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);
    mockTailwindProcessor.detectProfile.mockResolvedValue({
      profile: 'advanced',
      reason: 'tailwind.config.* detected at /workspace/tailwind.config.ts',
      workspaceRoot: '/workspace',
      configPath: '/workspace/tailwind.config.ts',
      entryCssPath: '/workspace/tailwind.css',
      hasTailwindInput: true,
      inlineTailwindStyles: [],
    });

    await evaluateInWebview(
      preview as unknown as MockPreview,
      '# doc',
      '/workspace/doc.mdx'
    );
    await evaluateInWebview(
      preview as unknown as MockPreview,
      '# doc',
      '/workspace/doc.mdx'
    );

    expect(mockStatusBarMessage).toHaveBeenCalledTimes(1);
    expect(mockStatusBarMessage).toHaveBeenCalledWith(
      expect.stringContaining(
        'advanced config detected (tailwind.config.* detected at /workspace/tailwind.config.ts)'
      ),
      10000
    );

    expect(preview.webviewHandle.setTailwindBrowserCss).toHaveBeenCalledWith(
      ''
    );
    expect(preview.webviewHandle.setTailwindCss).toHaveBeenCalledWith('');
    expect(mockEngine.evaluateSafe).toHaveBeenCalledTimes(2);
  });

  it('clears frontmatter in webview state when frontmatter panel is disabled', async () => {
    mockSafeState();
    const preview = createPreview();

    preview.runtimeConfiguration.showFrontmatter = false;
    mockEngine.evaluateSafe.mockResolvedValueOnce({
      html: '<p>safe</p>',
      frontmatter: {
        title: 'Should Not Render',
      },
    });

    await evaluateInWebview(
      preview as unknown as MockPreview,
      '# doc',
      '/workspace/doc.mdx'
    );

    expect(preview.webviewHandle.setFrontmatter).toHaveBeenCalledWith({});
  });

  it('sends frontmatter when panel is enabled', async () => {
    mockTrustedState();
    const preview = createPreview();

    preview.runtimeConfiguration.showFrontmatter = true;
    preview.runtimeConfiguration.showToc = true;
    mockEngine.evaluateTrusted.mockResolvedValueOnce({
      code: 'export default function Demo() { return null; }',
      entryFilePath: '/workspace/doc.mdx',
      dependencies: [],
      frontmatter: {
        title: 'Hello',
        tags: ['mdx', 'preview'],
      },
    });

    await evaluateInWebview(
      preview as unknown as MockPreview,
      '# doc',
      '/workspace/doc.mdx'
    );

    expect(preview.webviewHandle.setFrontmatter).toHaveBeenCalledWith({
      title: 'Hello',
      tags: ['mdx', 'preview'],
    });
    expect(preview.setFrontmatterState).toHaveBeenCalledWith({
      title: 'Hello',
      tags: ['mdx', 'preview'],
    });
    expect(preview.pushRuntimeConfiguration).toHaveBeenCalled();
    expect(preview.webviewHandle.setShowToc).toHaveBeenCalledWith(true);
    expect(preview.webviewHandle.setSourceLineHighlight).toHaveBeenCalledWith(
      true
    );
    expect(
      preview.webviewHandle.setSourceLineHighlightColor
    ).toHaveBeenCalledWith('dependent');
    expect(preview.webviewHandle.setShimSideRail).toHaveBeenCalledWith(true);
  });
});
