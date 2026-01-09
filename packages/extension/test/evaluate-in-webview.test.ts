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
import { handleDidChangeWorkspaceFolders } from '../security/checkFsPath';

// mock module-fetcher/transform
vi.mock('../module-fetcher/transform', () => ({
  transformEntry: vi.fn(),
}));

// mock transpiler/mdx/mdx-safe
vi.mock('../transpiler/mdx/mdx-safe', () => ({
  compileToSafeHTML: vi.fn(),
}));

// mock fs.promises
vi.mock('fs', () => ({
  promises: {
    realpath: vi.fn(async (path: string) => path),
  },
}));

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

// Note: performance API is available in Node.js - we spy on it in tests rather than stubbing

// import after mocks are set up
import evaluateInWebview from '../preview/evaluate-in-webview';
import { transformEntry } from '../module-fetcher/transform';
import { compileToSafeHTML } from '../transpiler/mdx/mdx-safe';
import type { Preview } from '../preview/preview-manager';
import type * as vscode from 'vscode';

// create mock webview handle
const createMockWebviewHandle = () => ({
  setTrustState: vi.fn(),
  updatePreview: vi.fn(),
  updatePreviewSafe: vi.fn(),
  showPreviewError: vi.fn(),
  invalidate: vi.fn(),
  setStale: vi.fn(),
  setCustomCss: vi.fn(),
  setTheme: vi.fn(),
  zoomIn: vi.fn(),
  zoomOut: vi.fn(),
  resetZoom: vi.fn(),
});

// create mock Preview object
const createMockPreview = (overrides: Partial<Preview> = {}): Preview => {
  const webviewHandle = createMockWebviewHandle();
  return {
    doc: {
      uri: Uri.file('/projects/test-workspace/README.mdx'),
    } as vscode.TextDocument,
    webviewHandle,
    webviewHandshakePromise: Promise.resolve(),
    onWebviewReady: vi.fn(),
    pushThemeState: vi.fn(),
    ...overrides,
  } as unknown as Preview;
};

// reset TrustManager singleton between tests
const resetTrustManager = (): void => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (TrustManager as any).instance = undefined;
};

describe('evaluateInWebview', () => {
  let mockPreview: Preview;

  beforeEach(() => {
    __resetMocks();
    resetTrustManager();
    handleDidChangeWorkspaceFolders();
    vi.clearAllMocks();

    __setMockWorkspaceFolders([
      { uri: { fsPath: '/projects/test-workspace' } },
    ]);
    handleDidChangeWorkspaceFolders();

    mockPreview = createMockPreview();
  });

  afterEach(() => {
    try {
      TrustManager.getInstance().dispose();
    } catch {
      // ignore if already disposed
    }
    resetTrustManager();
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

      expect(mockPreview.webviewHandle.showPreviewError).toHaveBeenCalledWith({
        message: 'Transform failed',
        stack: 'Error: Transform failed\n    at test.ts:1:1',
      });
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

      expect(mockPreview.webviewHandle.showPreviewError).toHaveBeenCalledWith({
        message: 'String error',
        stack: undefined,
      });
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
        expect.any(Array),
        { title: 'Test' }
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
      // Note: the actual code uses `if (frontmatter)` which is truthy for empty objects
      // This behavior may be intentional for theme state initialization
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

      // empty object is truthy, so pushThemeState is called
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

      expect(compileToSafeHTML).toHaveBeenCalledWith(mdxText);
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
        '<h1>Hello</h1><p>World</p>',
        { title: 'Test' }
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
      // use the real performance API but spy on it
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
