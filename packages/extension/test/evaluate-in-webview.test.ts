// packages/extension/test/evaluate-in-webview.test.ts
// unit tests for evaluate-in-webview (trust-based routing between Safe & Trusted modes)

import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import {
  __setMockTrusted,
  __setMockConfig,
  __setMockWorkspaceFolders,
  __resetMocks,
  Uri,
} from './__mocks__/vscode';
import { TrustManager } from '../security/TrustManager';
import { ServiceRegistry } from '../services/ServiceRegistry';
import { ServiceNames } from '../services/service-names';
import { handleDidChangeWorkspaceFolders } from '../security/checkFsPath';
import { ErrorReporter } from '../errors/ErrorReporter';

// mock module-fetcher/transform
vi.mock('../module-fetcher/transform', () => ({
  transformEntry: vi.fn(),
}));

// mock transpiler/mdx/mdx-safe
vi.mock('../transpiler/mdx/mdx-safe', () => ({
  compileToSafeHTML: vi.fn(),
}));

// stub fs.promises w/ dependencies' required methods (enhanced-resolve, etc.)
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    promises: {
      ...actual.promises,
      realpath: vi.fn(async (path: string) => path),
    },
  };
});

// mock es-module-lexer
vi.mock('es-module-lexer', () => ({
  init: Promise.resolve(),
  parse: vi.fn(() => [[], []]),
}));

// mock logging to suppress output during tests
vi.mock('../logging', () => ({
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}));

// mock resolver-factory to prevent CachedInputFileSystem from requiring fs methods
vi.mock('../module-fetcher/resolver-factory', () => ({
  getNodeResolver: vi.fn(() => ({
    resolveSync: vi.fn(),
  })),
}));

// mock Tailwind processor
vi.mock('../tailwind/TailwindProcessor', () => ({
  TailwindProcessor: {
    getInstance: () => ({
      process: vi.fn(async () => ({
        css: '',
        watchFiles: [],
        enabled: false,
      })),
    }),
  },
}));

// stub getConfigManager for TrustManager dependency
// use dynamic import to access vscode mock's config store at runtime
vi.mock('../services', async (importOriginal) => {
  const original = await importOriginal<typeof import('../services')>();
  const vscode = await import('./__mocks__/vscode');
  return {
    ...original,
    getConfigManager: () => ({
      get: (key: string, _scope?: unknown) => {
        // read from vscode mock's config store (set via __setMockConfig)
        const value = vscode.__getMockConfig(key);
        return value !== undefined ? value : vscode.CONFIG_DEFAULTS[key];
      },
      set: vi.fn(),
    }),
    getErrorReporter: () => ({
      report: vi.fn(
        (
          error: Error | unknown,
          options?: { showInWebview?: boolean; webviewHandle?: any }
        ) => {
          // apply showInWebview behavior to match real ErrorReporter
          if (options?.showInWebview && options?.webviewHandle) {
            const message =
              error instanceof Error ? error.message : String(error);
            options.webviewHandle.showPreviewError({
              message,
              stack: error instanceof Error ? error.stack : undefined,
            });
          }
        }
      ),
      reportSilent: vi.fn(),
      reportToUser: vi.fn(),
      reportConfigError: vi.fn(),
      reportPluginError: vi.fn(),
      reportWithActions: vi.fn(),
      reportWebviewError: vi.fn(),
    }),
  };
});

// performance API is available in Node.js - spy on it rather than stubbing

// import after mocks configured
import evaluateInWebview from '../preview/evaluate-in-webview';
import { transformEntry } from '../module-fetcher/transform';
import { compileToSafeHTML } from '../transpiler/mdx/mdx-safe';
import type { Preview } from '../preview/preview-manager';
import type * as vscode from 'vscode';

// generate mock webview handle for testing
const createMockWebviewHandle = () => ({
  setTrustState: vi.fn(),
  updatePreview: vi.fn(),
  updatePreviewSafe: vi.fn(),
  showPreviewError: vi.fn(),
  invalidate: vi.fn(),
  setStale: vi.fn(),
  setCustomCss: vi.fn(),
  setTailwindCss: vi.fn(),
  setTheme: vi.fn(),
  zoomIn: vi.fn(),
  zoomOut: vi.fn(),
  resetZoom: vi.fn(),
});

// generate mock Preview object for testing
const createMockPreview = (overrides: Partial<Preview> = {}): Preview => {
  const webviewHandle = createMockWebviewHandle();
  let tailwindRequestId = 0;
  return {
    doc: {
      uri: Uri.file('/projects/test-workspace/README.mdx'),
    } as vscode.TextDocument,
    webviewHandle,
    webviewHandshakePromise: Promise.resolve(),
    onWebviewReady: vi.fn(),
    pushThemeState: vi.fn(),
    updateDependencies: vi.fn(),
    updateTailwindWatchFiles: vi.fn(),
    nextTailwindRequestId: vi.fn(() => ++tailwindRequestId),
    isTailwindRequestCurrent: vi.fn(() => true),
    ...overrides,
  } as unknown as Preview;
};

// clear TrustManager singleton between test cases
const resetTrustManager = (): void => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (TrustManager as any).instance = undefined;
};

describe('evaluateInWebview', () => {
  let mockPreview: Preview;

  beforeEach(() => {
    __resetMocks();
    resetTrustManager();
    ServiceRegistry.reset();
    handleDidChangeWorkspaceFolders();
    vi.clearAllMocks();

    __setMockWorkspaceFolders([
      { uri: { fsPath: '/projects/test-workspace' } },
    ]);
    handleDidChangeWorkspaceFolders();

    // register services & ServiceRegistry
    const registry = ServiceRegistry.getInstance();
    registry.register(ServiceNames.TRUST_MANAGER, () =>
      TrustManager.getInstance()
    );
    registry.register(ServiceNames.ERROR_REPORTER, () =>
      ErrorReporter.getInstance()
    );

    mockPreview = createMockPreview();
  });

  afterEach(() => {
    try {
      TrustManager.getInstance().dispose();
    } catch {
      // suppress if already disposed
    }
    resetTrustManager();
    ServiceRegistry.reset();
    // clear ErrorReporter's dedupe cache between test cases
    ErrorReporter.dispose();
  });

  describe('routing based on trust state', () => {
    test('uses Trusted Mode when canExecute is true', async () => {
      __setMockTrusted(true);
      __setMockConfig('preview.enableScripts', true);

      vi.mocked(transformEntry).mockResolvedValue({
        code: 'export default function() {}',
        frontmatter: {},
      });

      await evaluateInWebview(
        mockPreview,
        '# Hello',
        '/projects/test-workspace/README.mdx'
      );

      expect(transformEntry).toHaveBeenCalled();
      expect(compileToSafeHTML).not.toHaveBeenCalled();
      expect(mockPreview.webviewHandle.updatePreview).toHaveBeenCalled();
      expect(
        mockPreview.webviewHandle.updatePreviewSafe
      ).not.toHaveBeenCalled();
    });

    test('uses Safe Mode when workspace is not trusted', async () => {
      __setMockTrusted(false);
      __setMockConfig('preview.enableScripts', true);

      vi.mocked(compileToSafeHTML).mockResolvedValue({
        html: '<h1>Hello</h1>',
        frontmatter: {},
      });

      await evaluateInWebview(
        mockPreview,
        '# Hello',
        '/projects/test-workspace/README.mdx'
      );

      expect(compileToSafeHTML).toHaveBeenCalled();
      expect(transformEntry).not.toHaveBeenCalled();
      expect(mockPreview.webviewHandle.updatePreviewSafe).toHaveBeenCalled();
      expect(mockPreview.webviewHandle.updatePreview).not.toHaveBeenCalled();
    });

    test('uses Safe Mode when scripts are disabled', async () => {
      __setMockTrusted(true);
      __setMockConfig('preview.enableScripts', false);

      vi.mocked(compileToSafeHTML).mockResolvedValue({
        html: '<h1>Hello</h1>',
        frontmatter: {},
      });

      await evaluateInWebview(
        mockPreview,
        '# Hello',
        '/projects/test-workspace/README.mdx'
      );

      expect(compileToSafeHTML).toHaveBeenCalled();
      expect(transformEntry).not.toHaveBeenCalled();
      expect(mockPreview.webviewHandle.updatePreviewSafe).toHaveBeenCalled();
    });
  });

  describe('trust state communication', () => {
    test('sends trust state to webview', async () => {
      __setMockTrusted(true);
      __setMockConfig('preview.enableScripts', true);

      vi.mocked(transformEntry).mockResolvedValue({
        code: 'export default function() {}',
        frontmatter: {},
      });

      await evaluateInWebview(
        mockPreview,
        '# Hello',
        '/projects/test-workspace/README.mdx'
      );

      expect(mockPreview.webviewHandle.setTrustState).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceTrusted: true,
          scriptsEnabled: true,
          canExecute: true,
        })
      );
    });

    test('sends correct trust state in Safe Mode', async () => {
      __setMockTrusted(false);
      __setMockConfig('preview.enableScripts', false);

      vi.mocked(compileToSafeHTML).mockResolvedValue({
        html: '<h1>Hello</h1>',
        frontmatter: {},
      });

      await evaluateInWebview(
        mockPreview,
        '# Hello',
        '/projects/test-workspace/README.mdx'
      );

      expect(mockPreview.webviewHandle.setTrustState).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceTrusted: false,
          scriptsEnabled: false,
          canExecute: false,
        })
      );
    });
  });

  describe('handshake', () => {
    test('waits for webview handshake before evaluation', async () => {
      __setMockTrusted(true);
      __setMockConfig('preview.enableScripts', true);

      let handshakeResolved = false;
      const handshakePromise = new Promise<void>((resolve) => {
        setTimeout(() => {
          handshakeResolved = true;
          resolve();
        }, 10);
      });

      mockPreview = createMockPreview({
        webviewHandshakePromise: handshakePromise,
      });

      vi.mocked(transformEntry).mockResolvedValue({
        code: 'export default function() {}',
        frontmatter: {},
      });

      await evaluateInWebview(
        mockPreview,
        '# Hello',
        '/projects/test-workspace/README.mdx'
      );

      expect(handshakeResolved).toBe(true);
      expect(mockPreview.webviewHandle.updatePreview).toHaveBeenCalled();
    });

    test('calls onWebviewReady after handshake', async () => {
      __setMockTrusted(true);
      __setMockConfig('preview.enableScripts', true);

      vi.mocked(transformEntry).mockResolvedValue({
        code: 'export default function() {}',
        frontmatter: {},
      });

      await evaluateInWebview(
        mockPreview,
        '# Hello',
        '/projects/test-workspace/README.mdx'
      );

      expect(mockPreview.onWebviewReady).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    test('catches evaluation errors', async () => {
      __setMockTrusted(true);
      __setMockConfig('preview.enableScripts', true);

      vi.mocked(transformEntry).mockRejectedValue(
        new Error('Transform failed')
      );

      await evaluateInWebview(
        mockPreview,
        '# Hello',
        '/projects/test-workspace/README.mdx'
      );

      expect(mockPreview.webviewHandle.showPreviewError).toHaveBeenCalled();
    });

    test('sends error to webview via showPreviewError', async () => {
      __setMockTrusted(true);
      __setMockConfig('preview.enableScripts', true);

      const testError = new Error('Transform failed');
      testError.stack = 'Error: Transform failed\n    at test.ts:1:1';
      vi.mocked(transformEntry).mockRejectedValue(testError);

      await evaluateInWebview(
        mockPreview,
        '# Hello',
        '/projects/test-workspace/README.mdx'
      );

      // ErrorReporter sends error w/ message, code & stack
      expect(mockPreview.webviewHandle.showPreviewError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Transform failed',
        })
      );
    });

    test('handles non-Error throws', async () => {
      __setMockTrusted(true);
      __setMockConfig('preview.enableScripts', true);

      vi.mocked(transformEntry).mockRejectedValue('String error');

      await evaluateInWebview(
        mockPreview,
        '# Hello',
        '/projects/test-workspace/README.mdx'
      );

      // ErrorReporter wraps non-Error throws in Error & creates stack
      expect(mockPreview.webviewHandle.showPreviewError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'String error',
        })
      );
    });

    test('handles Safe Mode compilation errors', async () => {
      __setMockTrusted(false);
      __setMockConfig('preview.enableScripts', false);

      vi.mocked(compileToSafeHTML).mockRejectedValue(
        new Error('MDX compilation failed')
      );

      await evaluateInWebview(
        mockPreview,
        '# Hello',
        '/projects/test-workspace/README.mdx'
      );

      expect(mockPreview.webviewHandle.showPreviewError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'MDX compilation failed',
        })
      );
    });
  });

  describe('Trusted Mode evaluation', () => {
    test('passes text and fsPath to transformEntry', async () => {
      __setMockTrusted(true);
      __setMockConfig('preview.enableScripts', true);

      vi.mocked(transformEntry).mockResolvedValue({
        code: 'export default function() {}',
        frontmatter: {},
      });

      const mdxText = '# Hello\n\nWorld';
      const fsPath = '/projects/test-workspace/README.mdx';

      await evaluateInWebview(mockPreview, mdxText, fsPath);

      expect(transformEntry).toHaveBeenCalledWith(mdxText, fsPath, mockPreview);
    });

    test('sends code to webview via updatePreview', async () => {
      __setMockTrusted(true);
      __setMockConfig('preview.enableScripts', true);

      vi.mocked(transformEntry).mockResolvedValue({
        code: 'const Component = () => null; export default Component;',
        frontmatter: { title: 'Test' },
      });

      await evaluateInWebview(
        mockPreview,
        '# Hello',
        '/projects/test-workspace/README.mdx'
      );

      expect(mockPreview.webviewHandle.updatePreview).toHaveBeenCalledWith(
        'const Component = () => null; export default Component;',
        '/projects/test-workspace/README.mdx',
        expect.any(Array)
      );
    });

    test('passes frontmatter to pushThemeState', async () => {
      __setMockTrusted(true);
      __setMockConfig('preview.enableScripts', true);

      const frontmatter = { title: 'Test', theme: 'dark' };
      vi.mocked(transformEntry).mockResolvedValue({
        code: 'export default function() {}',
        frontmatter,
      });

      await evaluateInWebview(
        mockPreview,
        '# Hello',
        '/projects/test-workspace/README.mdx'
      );

      expect(mockPreview.pushThemeState).toHaveBeenCalledWith(frontmatter);
    });

    test('calls pushThemeState even with empty frontmatter', async () => {
      // actual code uses `if (frontmatter)` which is truthy for empty objects
      // behavior is intentional for theme state initialization
      __setMockTrusted(true);
      __setMockConfig('preview.enableScripts', true);

      vi.mocked(transformEntry).mockResolvedValue({
        code: 'export default function() {}',
        frontmatter: {},
      });

      await evaluateInWebview(
        mockPreview,
        '# Hello',
        '/projects/test-workspace/README.mdx'
      );

      // empty object is truthy, pushThemeState called
      expect(mockPreview.pushThemeState).toHaveBeenCalledWith({});
    });
  });

  describe('Safe Mode evaluation', () => {
    test('passes text to compileToSafeHTML', async () => {
      __setMockTrusted(false);
      __setMockConfig('preview.enableScripts', false);

      vi.mocked(compileToSafeHTML).mockResolvedValue({
        html: '<h1>Hello</h1>',
        frontmatter: {},
      });

      const mdxText = '# Hello\n\nWorld';

      await evaluateInWebview(
        mockPreview,
        mdxText,
        '/projects/test-workspace/README.mdx'
      );

      expect(compileToSafeHTML).toHaveBeenCalledWith(
        mdxText,
        mockPreview.mdxPreviewConfig
      );
    });

    test('sends HTML to webview via updatePreviewSafe', async () => {
      __setMockTrusted(false);
      __setMockConfig('preview.enableScripts', false);

      vi.mocked(compileToSafeHTML).mockResolvedValue({
        html: '<h1>Hello</h1><p>World</p>',
        frontmatter: { title: 'Test' },
      });

      await evaluateInWebview(
        mockPreview,
        '# Hello\n\nWorld',
        '/projects/test-workspace/README.mdx'
      );

      expect(mockPreview.webviewHandle.updatePreviewSafe).toHaveBeenCalledWith(
        '<h1>Hello</h1><p>World</p>'
      );
    });

    test('passes frontmatter to pushThemeState in Safe Mode', async () => {
      __setMockTrusted(false);
      __setMockConfig('preview.enableScripts', false);

      const frontmatter = { title: 'Test', theme: 'light' };
      vi.mocked(compileToSafeHTML).mockResolvedValue({
        html: '<h1>Hello</h1>',
        frontmatter,
      });

      await evaluateInWebview(
        mockPreview,
        '# Hello',
        '/projects/test-workspace/README.mdx'
      );

      expect(mockPreview.pushThemeState).toHaveBeenCalledWith(frontmatter);
    });
  });

  describe('performance tracking', () => {
    test('marks preview/start at beginning', async () => {
      // spy on real performance API
      const markSpy = vi.spyOn(performance, 'mark');

      __setMockTrusted(true);
      __setMockConfig('preview.enableScripts', true);

      vi.mocked(transformEntry).mockResolvedValue({
        code: 'export default function() {}',
        frontmatter: {},
      });

      await evaluateInWebview(
        mockPreview,
        '# Hello',
        '/projects/test-workspace/README.mdx'
      );

      expect(markSpy).toHaveBeenCalledWith('preview/start');
      markSpy.mockRestore();
    });
  });
});
