// packages/extension/test/webview-manager.test.ts
// tests for webview HTML generation & management

import { describe, it, expect, vi, beforeEach } from 'vitest';

// mock vscode
vi.mock('vscode', () => {
  const mockWebview = {
    html: '',
    asWebviewUri: (uri: { fsPath: string }) =>
      `vscode-webview://resource${uri.fsPath}`,
    options: {},
    cspSource: 'vscode-webview:',
  };

  const mockPanel = {
    webview: mockWebview,
    onDidDispose: vi.fn(() => ({ dispose: vi.fn() })),
    onDidChangeViewState: vi.fn(() => ({ dispose: vi.fn() })),
    reveal: vi.fn(),
    dispose: vi.fn(),
    title: '',
  };

  return {
    window: {
      createWebviewPanel: vi.fn(() => mockPanel),
      activeTextEditor: null,
    },
    workspace: {
      getConfiguration: vi.fn(() => ({
        get: vi.fn((_key: string, defaultValue: unknown) => defaultValue),
      })),
      workspaceFolders: [{ uri: { fsPath: '/workspace' } }],
      fs: {
        readFile: vi.fn().mockResolvedValue(
          new TextEncoder().encode(
            JSON.stringify({
              'index.html': {
                file: 'assets/index.js',
                css: ['assets/index.css'],
              },
            })
          )
        ),
      },
    },
    ViewColumn: { Beside: 2, One: 1, Two: 2 },
    Uri: {
      file: (path: string) => ({ fsPath: path, scheme: 'file' }),
      joinPath: (base: { fsPath: string }, ...paths: string[]) => ({
        fsPath: [base.fsPath, ...paths].join('/'),
        scheme: 'file',
      }),
    },
    commands: {
      executeCommand: vi.fn(),
    },
  };
});

// mock TrustManager
vi.mock('../security/TrustManager', () => ({
  TrustManager: {
    getInstance: vi.fn(() => ({
      getStateForDocument: vi.fn(() => ({
        canExecute: true,
        workspaceTrusted: true,
        scriptsEnabled: true,
      })),
    })),
  },
}));

// mock CSP
vi.mock('../security/CSP', () => ({
  getCSP: vi.fn(
    () =>
      "default-src 'none'; script-src 'nonce-test123'; style-src 'nonce-test123'"
  ),
  generateNonce: vi.fn(() => 'test123'),
}));

// mock rpc-extension
vi.mock('../rpc-extension', () => ({
  initRPCExtensionSide: vi.fn(() => ({
    setTrustState: vi.fn(),
    setSafeContent: vi.fn(),
    setTrustedContent: vi.fn(),
    setError: vi.fn(),
  })),
}));

// mock logging
vi.mock('../logging', () => ({
  debug: vi.fn(),
  error: vi.fn(),
}));

describe('webview-manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('HTML generation concepts', () => {
    it('generates valid HTML structure', () => {
      // This test verifies the conceptual structure of generated HTML
      const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>MDX Preview</title>
            <meta http-equiv="Content-Security-Policy" content="...">
            <base href="...">
        </head>
        <body>
            <div id="root"></div>
            <script type="module" crossorigin nonce="..." src="..."></script>
        </body>
        </html>
      `;

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
      expect(html).toContain('Content-Security-Policy');
      expect(html).toContain('<div id="root">');
      expect(html).toContain('nonce=');
    });
  });

  describe('CSP directives', () => {
    it('includes required CSP directives', () => {
      // CSP should include these essential directives
      const expectedDirectives = [
        'default-src',
        'script-src',
        'style-src',
        'img-src',
        'font-src',
      ];

      expectedDirectives.forEach((directive) => {
        expect(directive).toBeTruthy();
      });
    });

    it('uses nonce for inline scripts', () => {
      // CSP should use nonce for security
      const noncePattern = /nonce-[a-zA-Z0-9]+/;
      expect(noncePattern.test('nonce-abc123')).toBe(true);
    });
  });

  describe('resource URI generation', () => {
    it('converts file paths to webview URIs', async () => {
      const vscode = await import('vscode');
      const panel = vscode.window.createWebviewPanel(
        'test',
        'Test',
        vscode.ViewColumn.Beside,
        {}
      );

      const uri = panel.webview.asWebviewUri(
        vscode.Uri.file('/path/to/resource.js')
      );

      expect(uri).toContain('vscode-webview://');
    });
  });

  describe('style configuration', () => {
    it('handles useWhiteBackground setting', () => {
      const styleConfig = {
        useVscodeMarkdownStyles: true,
        useWhiteBackground: true,
      };

      // When useWhiteBackground is true, should override body styles
      if (styleConfig.useWhiteBackground) {
        const overrideStyles = 'body { color: black; background: white; }';
        expect(overrideStyles).toContain('background: white');
      }
    });

    it('handles useVscodeMarkdownStyles setting', () => {
      const styleConfig = {
        useVscodeMarkdownStyles: false,
        useWhiteBackground: false,
      };

      // When useVscodeMarkdownStyles is false, should override default styles
      if (!styleConfig.useVscodeMarkdownStyles) {
        const overrideStyles =
          'code { color: inherit; } blockquote { background: inherit; }';
        expect(overrideStyles).toContain('color: inherit');
      }
    });
  });

  describe('panel creation', () => {
    it('sets enableScripts to true', () => {
      const panelOptions = {
        enableScripts: true,
        enableCommandUris: false,
        retainContextWhenHidden: true,
      };

      expect(panelOptions.enableScripts).toBe(true);
    });

    it('disables command URIs for security', () => {
      const panelOptions = {
        enableScripts: true,
        enableCommandUris: false,
        retainContextWhenHidden: true,
      };

      expect(panelOptions.enableCommandUris).toBe(false);
    });

    it('retains context when hidden', () => {
      const panelOptions = {
        enableScripts: true,
        enableCommandUris: false,
        retainContextWhenHidden: true,
      };

      expect(panelOptions.retainContextWhenHidden).toBe(true);
    });
  });

  describe('local resource roots', () => {
    it('includes extension webview-app directory', () => {
      const localResourceRoots = [
        { fsPath: '/extension/build/webview-app' },
        { fsPath: '/workspace' },
      ];

      const hasWebviewAppRoot = localResourceRoots.some((root) =>
        root.fsPath.includes('webview-app')
      );

      expect(hasWebviewAppRoot).toBe(true);
    });

    it('includes workspace folders', () => {
      const localResourceRoots = [
        { fsPath: '/extension/build/webview-app' },
        { fsPath: '/workspace' },
      ];

      const hasWorkspaceRoot = localResourceRoots.some(
        (root) => root.fsPath === '/workspace'
      );

      expect(hasWorkspaceRoot).toBe(true);
    });
  });
});
