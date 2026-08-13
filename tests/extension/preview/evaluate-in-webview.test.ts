// tests/extension/preview/evaluate-in-webview.test.ts
// unit tests for Tailwind profile routing in evaluate-in-webview

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  mockTrustManager,
  mockTailwindProcessor,
  mockFrameworkDetector,
  mockErrorReporter,
  mockThemeManager,
} from '../../helpers/mock-services';
import type {
  ModuleDependency,
  PreviewRuntimeConfig,
} from '@mdx-preview/contracts';

const {
  mockStatusBarMessage,
  mockEngine,
  mockBuildEffectivePreviewConfig,
  mockToCompilerConfig,
  mockDetectComponents,
} = vi.hoisted(() => ({
  mockStatusBarMessage: vi.fn(),
  mockEngine: {
    evaluateTrusted: vi.fn(),
    evaluateSafe: vi.fn(),
    processTailwindAsync: vi.fn(),
  },
  mockBuildEffectivePreviewConfig: vi.fn(),
  mockToCompilerConfig: vi.fn(() => ({ some: 'compiler-config' })),
  mockDetectComponents: vi.fn(async () => ({
    components: [],
    imports: new Map(),
    errors: [],
  })),
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
  '../../../packages/extension-host/src/features/preview/configuration/EffectivePreviewConfig',
  () => ({
    buildEffectivePreviewConfig: (...args: unknown[]) =>
      mockBuildEffectivePreviewConfig(...args),
    toCompilerConfig: (...args: unknown[]) => mockToCompilerConfig(...args),
  })
);

vi.mock(
  '../../../packages/extension-host/src/features/diagnostics/ComponentDetector',
  () => ({
    detectComponents: mockDetectComponents,
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
import { PreviewWebviewBridge } from '../../../packages/extension-host/src/features/preview/PreviewWebviewBridge';

type MockPreview = ReturnType<typeof createPreview>;

function createPreview(): {
  doc: {
    uri: { scheme: string; fsPath: string; toString: () => string };
    version: number;
  };
  webviewHandle: {
    setTailwindBrowserCss: ReturnType<typeof vi.fn>;
    setTailwindCss: ReturnType<typeof vi.fn>;
    setTrustState: ReturnType<typeof vi.fn>;
    setFramework: ReturnType<typeof vi.fn>;
    updatePreviewSafe: ReturnType<typeof vi.fn>;
    updatePreview: ReturnType<typeof vi.fn>;
    setUsedComponents: ReturnType<typeof vi.fn>;
    setNextraMeta: ReturnType<typeof vi.fn>;
    setTheme: ReturnType<typeof vi.fn>;
    setRuntimeConfig: ReturnType<typeof vi.fn>;
    setCustomCss: ReturnType<typeof vi.fn>;
  };
  runtimeConfiguration: PreviewRuntimeConfig;
  webviewHandshakePromise: Promise<void>;
  onWebviewReady: ReturnType<typeof vi.fn>;
  applyFrontmatterTheme: ReturnType<typeof vi.fn>;
  pushThemeState: ReturnType<typeof vi.fn>;
  pushRuntimeConfiguration: ReturnType<typeof vi.fn>;
  updateDependencies: ReturnType<typeof vi.fn>;
  updateTailwindWatchFiles: ReturnType<typeof vi.fn>;
  nextTailwindRequestId: ReturnType<typeof vi.fn>;
  isTailwindRequestCurrent: ReturnType<typeof vi.fn>;
  markTailwindFallbackReason: ReturnType<typeof vi.fn>;
  clearTailwindFallbackReason: ReturnType<typeof vi.fn>;
  setTailwindBrowserRuntimeEnabled: ReturnType<typeof vi.fn>;
  refreshWebview: ReturnType<typeof vi.fn>;
  syncEditorScrollToPreview: ReturnType<typeof vi.fn>;
  entryFsDirectory: string;
  mdxPreviewConfig: undefined;
} {
  const runtimeConfiguration: PreviewRuntimeConfig = {
    sourceLineHighlight: true,
    sourceLineHighlightColor: 'dependent',
    scrollSync: 'off',
    shimSideRail: true,
  };
  const webviewHandle = {
    setTailwindBrowserCss: vi.fn(),
    setTailwindCss: vi.fn(),
    setTrustState: vi.fn(),
    setFramework: vi.fn(),
    updatePreviewSafe: vi.fn(),
    updatePreview: vi.fn(),
    setUsedComponents: vi.fn(),
    setNextraMeta: vi.fn(),
    setTheme: vi.fn(),
    setRuntimeConfig: vi.fn(),
    setCustomCss: vi.fn(),
  };
  const pushRuntimeConfiguration = vi.fn(() => {
    webviewHandle.setRuntimeConfig(runtimeConfiguration);
  });

  const preview = {
    doc: {
      uri: {
        scheme: 'file',
        fsPath: '/workspace/doc.mdx',
        toString: () => 'file:///workspace/doc.mdx',
      },
      version: 1,
    },
    webviewHandle,
    runtimeConfiguration,
    webviewHandshakePromise: Promise.resolve(),
    onWebviewReady: vi.fn(),
    applyFrontmatterTheme: vi.fn(),
    pushThemeState: vi.fn(),
    pushRuntimeConfiguration,
    updateDependencies: vi.fn(),
    updateTailwindWatchFiles: vi.fn(),
    nextTailwindRequestId: vi.fn(() => 1),
    isTailwindRequestCurrent: vi.fn(() => true),
    markTailwindFallbackReason: vi.fn(() => true),
    clearTailwindFallbackReason: vi.fn(),
    setTailwindBrowserRuntimeEnabled: vi.fn(() => false),
    refreshWebview: vi.fn(async () => {}),
    syncEditorScrollToPreview: vi.fn(),
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

  it('skips Tailwind discovery in Safe Mode and clears CSS channels', async () => {
    mockSafeState();

    const preview = createPreview();

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

    expect(mockTailwindProcessor.detectProfile).not.toHaveBeenCalled();
    expect(mockStatusBarMessage).not.toHaveBeenCalled();
    expect(preview.webviewHandle.setTailwindBrowserCss).toHaveBeenCalledWith(
      ''
    );
    expect(preview.webviewHandle.setTailwindCss).toHaveBeenCalledWith('');
    expect(mockEngine.evaluateSafe).toHaveBeenCalledTimes(2);
    expect(preview.updateDependencies).toHaveBeenNthCalledWith(1, []);
    expect(preview.updateDependencies).toHaveBeenNthCalledWith(2, []);
  });

  it('retains effective theme inputs across unchanged state & failure', async () => {
    mockTrustedState();
    let codeBlockTheme = 'github-dark';
    mockThemeManager.extractThemeFromFrontmatter.mockImplementation(
      (frontmatter) => ({
        ...(typeof frontmatter.previewTheme === 'string'
          ? { previewTheme: frontmatter.previewTheme }
          : {}),
      })
    );
    mockThemeManager.getWebviewThemeState.mockImplementation(
      (_docUri, overrides = {}) => ({
        previewTheme: overrides.previewTheme ?? 'github-light',
        codeBlockTheme,
      })
    );
    mockEngine.evaluateTrusted.mockResolvedValue({
      code: 'export default function Demo() { return null; }',
      entryFilePath: '/workspace/doc.mdx',
      dependencies: [],
      frontmatter: { previewTheme: 'github-dark' },
    });
    const preview = createPreview();
    const rawHandle = preview.webviewHandle;
    const bridge = new PreviewWebviewBridge();
    bridge.setWebviewHandle(
      rawHandle as never,
      { get: vi.fn(() => undefined) } as never
    );
    preview.webviewHandle = bridge.getHandle() as typeof rawHandle;
    preview.onWebviewReady.mockImplementation(() => {
      bridge.onWebviewReady(preview.doc.uri as never);
    });
    preview.applyFrontmatterTheme.mockImplementation((frontmatter) => {
      bridge.applyFrontmatterTheme(preview.doc.uri as never, frontmatter);
    });
    preview.pushThemeState.mockImplementation(() => {
      bridge.pushThemeState(preview.doc.uri as never);
    });
    preview.pushRuntimeConfiguration.mockImplementation(() => {
      bridge.pushRuntimeConfiguration(preview.runtimeConfiguration);
    });

    await evaluateInWebview(
      preview as unknown as MockPreview,
      '# first',
      '/workspace/doc.mdx'
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    vi.clearAllMocks();

    await evaluateInWebview(
      preview as unknown as MockPreview,
      '# second',
      '/workspace/doc.mdx'
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(preview.onWebviewReady).not.toHaveBeenCalled();
    expect(rawHandle.updatePreview).toHaveBeenCalledTimes(1);
    expect(rawHandle.setTrustState).not.toHaveBeenCalled();
    expect(rawHandle.setRuntimeConfig).not.toHaveBeenCalled();
    expect(rawHandle.setTheme).not.toHaveBeenCalled();

    codeBlockTheme = 'monokai';
    mockEngine.evaluateTrusted.mockRejectedValueOnce(
      new Error('current evaluation failed')
    );
    await evaluateInWebview(
      preview as unknown as MockPreview,
      '# malformed',
      '/workspace/doc.mdx'
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(rawHandle.setTheme).toHaveBeenLastCalledWith(
      expect.objectContaining({
        previewTheme: 'github-dark',
        codeBlockTheme: 'monokai',
      })
    );

    mockEngine.evaluateTrusted.mockResolvedValueOnce({
      code: 'export default function Demo() { return null; }',
      entryFilePath: '/workspace/doc.mdx',
      dependencies: [],
      frontmatter: undefined,
    });
    await evaluateInWebview(
      preview as unknown as MockPreview,
      '# recovered',
      '/workspace/doc.mdx'
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(rawHandle.setTheme).toHaveBeenLastCalledWith(
      expect.objectContaining({
        previewTheme: 'github-light',
        codeBlockTheme: 'monokai',
      })
    );

    rawHandle.setTheme.mockClear();
    preview.applyFrontmatterTheme.mockClear();
    mockEngine.evaluateTrusted.mockResolvedValueOnce({
      code: 'export default function Demo() { return null; }',
      entryFilePath: '/workspace/doc.mdx',
      dependencies: [],
      frontmatter: { previewTheme: 'github-dark' },
    });
    rawHandle.updatePreview.mockRejectedValueOnce(
      new Error('content commit failed')
    );
    await evaluateInWebview(
      preview as unknown as MockPreview,
      '# failed commit',
      '/workspace/doc.mdx'
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(preview.applyFrontmatterTheme).not.toHaveBeenCalled();
    bridge.beginHandshake();
    bridge.onWebviewReady(preview.doc.uri as never);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(rawHandle.setTheme).toHaveBeenLastCalledWith(
      expect.objectContaining({
        previewTheme: 'github-light',
        codeBlockTheme: 'monokai',
      })
    );

    rawHandle.setTheme.mockClear();
    rawHandle.updatePreview.mockClear();
    rawHandle.setNextraMeta.mockClear();
    preview.applyFrontmatterTheme.mockClear();
    preview.updateDependencies.mockClear();
    let resolveStaleDetection: (() => void) | undefined;
    mockDetectComponents.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveStaleDetection = () =>
            resolve({ components: [], imports: new Map(), errors: [] });
        })
    );
    mockEngine.evaluateTrusted
      .mockResolvedValueOnce({
        code: 'export default function Stale() { return null; }',
        entryFilePath: '/workspace/doc.mdx',
        dependencies: [],
        frontmatter: { previewTheme: 'github-dark' },
      })
      .mockRejectedValueOnce(new Error('newer evaluation failed'));
    let evaluationToken = 1;
    const staleEvaluation = evaluateInWebview(
      preview as unknown as MockPreview,
      '# stale success',
      '/workspace/doc.mdx',
      () => evaluationToken === 1
    );
    for (let i = 0; i < 10 && !resolveStaleDetection; i++) {
      await Promise.resolve();
    }
    expect(resolveStaleDetection).toBeDefined();

    evaluationToken = 2;
    await evaluateInWebview(
      preview as unknown as MockPreview,
      '# newer failure',
      '/workspace/doc.mdx',
      () => evaluationToken === 2
    );
    resolveStaleDetection?.();
    await staleEvaluation;
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(preview.applyFrontmatterTheme).not.toHaveBeenCalled();
    expect(preview.updateDependencies).not.toHaveBeenCalled();
    expect(rawHandle.updatePreview).not.toHaveBeenCalled();
    expect(rawHandle.setNextraMeta).not.toHaveBeenCalled();
    bridge.beginHandshake();
    bridge.onWebviewReady(preview.doc.uri as never);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(rawHandle.setTheme).toHaveBeenLastCalledWith(
      expect.objectContaining({
        previewTheme: 'github-light',
        codeBlockTheme: 'monokai',
      })
    );
  });

  it('awaits webview pushes before downstream preview work', async () => {
    mockTrustedState();
    const trustedPreview = createPreview();
    const events: string[] = [];
    let resolveTrustState: (() => void) | undefined;

    trustedPreview.pushRuntimeConfiguration.mockImplementation(() => {
      events.push('setRuntimeConfig');
    });
    trustedPreview.webviewHandle.setTrustState.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          events.push('setTrustState');
          resolveTrustState = () => {
            events.push('trustStateResolved');
            resolve();
          };
        })
    );
    mockEngine.evaluateTrusted.mockImplementationOnce(async () => {
      events.push('evaluateTrusted');
      return {
        code: 'export default function Demo() { return null; }',
        entryFilePath: '/workspace/doc.mdx',
        dependencies: [],
        frontmatter: undefined,
      };
    });

    const pending = evaluateInWebview(
      trustedPreview as unknown as MockPreview,
      '# doc',
      '/workspace/doc.mdx'
    );
    trustedPreview.doc.version = 2;

    for (let i = 0; i < 5 && !resolveTrustState; i++) {
      await Promise.resolve();
    }

    expect(resolveTrustState).toBeDefined();
    expect(mockEngine.evaluateTrusted).not.toHaveBeenCalled();

    resolveTrustState?.();
    await pending;

    expect(events).toEqual([
      'setTrustState',
      'trustStateResolved',
      'setRuntimeConfig',
      'evaluateTrusted',
    ]);
    expect(trustedPreview.syncEditorScrollToPreview).toHaveBeenCalledTimes(1);
    expect(
      trustedPreview.webviewHandle.updatePreview.mock.invocationCallOrder[0]
    ).toBeLessThan(
      trustedPreview.syncEditorScrollToPreview.mock.invocationCallOrder[0]
    );
    expect(mockDetectComponents).toHaveBeenCalledWith(
      '# doc',
      { detectImports: true },
      new Set(),
      {
        uri: 'file:///workspace/doc.mdx',
        version: 1,
      }
    );

    mockSafeState();
    const safePreview = createPreview();

    await evaluateInWebview(
      safePreview as unknown as MockPreview,
      '# doc',
      '/workspace/doc.mdx'
    );

    expect(safePreview.syncEditorScrollToPreview).toHaveBeenCalledTimes(1);
    expect(
      safePreview.webviewHandle.updatePreviewSafe.mock.invocationCallOrder[0]
    ).toBeLessThan(
      safePreview.syncEditorScrollToPreview.mock.invocationCallOrder[0]
    );
  });

  it('drops a slow trusted result after a newer evaluation publishes', async () => {
    mockTrustedState();
    const preview = createPreview();
    let resolveOld:
      | ((result: {
          code: string;
          entryFilePath: string;
          dependencies: ModuleDependency[];
          frontmatter: undefined;
        }) => void)
      | undefined;

    mockEngine.evaluateTrusted
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve;
          })
      )
      .mockResolvedValueOnce({
        code: 'NEW',
        entryFilePath: '/workspace/new.mdx',
        dependencies: [
          {
            specifier: '/workspace/new.tsx',
            kind: 'import',
            runtimeRequest: '\0mdx-forge:import\0/workspace/new.tsx',
          },
        ],
        frontmatter: undefined,
      });

    let evaluationToken = 1;
    const oldEvaluation = evaluateInWebview(
      preview as unknown as MockPreview,
      'OLD',
      '/workspace/old.mdx',
      () => evaluationToken === 1
    );

    for (
      let i = 0;
      i < 10 && mockEngine.evaluateTrusted.mock.calls.length === 0;
      i++
    ) {
      await Promise.resolve();
    }
    expect(resolveOld).toBeDefined();

    evaluationToken = 2;
    await evaluateInWebview(
      preview as unknown as MockPreview,
      'NEW',
      '/workspace/new.mdx',
      () => evaluationToken === 2
    );

    resolveOld!({
      code: 'OLD',
      entryFilePath: '/workspace/old.mdx',
      dependencies: [
        {
          specifier: '/workspace/old.tsx',
          kind: 'import',
          runtimeRequest: '\0mdx-forge:import\0/workspace/old.tsx',
        },
      ],
      frontmatter: undefined,
    });
    await oldEvaluation;

    expect(preview.webviewHandle.updatePreview).toHaveBeenCalledTimes(1);
    expect(preview.webviewHandle.updatePreview).toHaveBeenCalledWith(
      'NEW',
      '/workspace/new.mdx',
      [
        {
          specifier: '/workspace/new.tsx',
          kind: 'import',
          runtimeRequest: '\0mdx-forge:import\0/workspace/new.tsx',
        },
      ]
    );
    expect(preview.updateDependencies).toHaveBeenCalledTimes(1);
    expect(preview.updateDependencies).toHaveBeenCalledWith([
      {
        specifier: '/workspace/new.tsx',
        kind: 'import',
        runtimeRequest: '\0mdx-forge:import\0/workspace/new.tsx',
      },
    ]);
    expect(mockErrorReporter.report).not.toHaveBeenCalled();
  });
});
