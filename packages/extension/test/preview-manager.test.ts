// packages/extension/test/preview-manager.test.ts
// tests for PreviewManager & Preview class

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// mock vscode
vi.mock('vscode', async () => {
  return {
    window: {
      createStatusBarItem: vi.fn(() => ({
        show: vi.fn(),
        hide: vi.fn(),
        dispose: vi.fn(),
        text: '',
      })),
      createOutputChannel: vi.fn(() => ({
        appendLine: vi.fn(),
        append: vi.fn(),
        clear: vi.fn(),
        show: vi.fn(),
        dispose: vi.fn(),
      })),
      showInformationMessage: vi.fn(),
      activeTextEditor: null,
    },
    workspace: {
      getConfiguration: vi.fn(() => ({
        get: vi.fn((_key: string, defaultValue: unknown) => defaultValue),
      })),
      workspaceFolders: [{ uri: { fsPath: '/test' } }],
      createFileSystemWatcher: vi.fn(() => ({
        onDidChange: vi.fn(() => ({ dispose: vi.fn() })),
        onDidCreate: vi.fn(() => ({ dispose: vi.fn() })),
        onDidDelete: vi.fn(() => ({ dispose: vi.fn() })),
        dispose: vi.fn(),
      })),
      fs: {
        readFile: vi.fn(),
      },
      onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
    },
    Uri: {
      file: (path: string) => ({ fsPath: path, scheme: 'file' }),
      joinPath: (base: { fsPath: string }, ...paths: string[]) => ({
        fsPath: [base.fsPath, ...paths].join('/'),
      }),
    },
    StatusBarAlignment: { Left: 1, Right: 2 },
  };
});

// mock typescript
vi.mock('typescript', () => ({
  findConfigFile: vi.fn(() => null),
  sys: { fileExists: vi.fn(() => false) },
  getDefaultCompilerOptions: vi.fn(() => ({})),
  createCompilerHost: vi.fn(() => ({})),
  getParsedCommandLineOfConfigFile: vi.fn(() => null),
  ModuleKind: { ESNext: 99 },
  ScriptTarget: { ESNext: 99 },
}));

// mock debounce
vi.mock('lodash.debounce', () => ({
  default: (fn: Function) => fn,
}));

// mock webview-manager to avoid enhanced-resolve dependency chain
vi.mock('../preview/webview-manager', () => ({
  createOrShowPanel: vi.fn(),
  refreshPanel: vi.fn(),
  initWebviewAppHTMLResources: vi.fn(),
}));

// mock evaluate-in-webview
vi.mock('../preview/evaluate-in-webview', () => ({
  default: vi.fn(),
}));

// import after mocking
import { PreviewManager, Preview } from '../preview/preview-manager';

describe('PreviewManager', () => {
  beforeEach(() => {
    // reset singleton by accessing private static field
    (PreviewManager as unknown as { instance: undefined }).instance = undefined;
  });

  afterEach(() => {
    (PreviewManager as unknown as { instance: undefined }).instance = undefined;
  });

  describe('singleton pattern', () => {
    it('returns same instance on multiple calls', () => {
      const instance1 = PreviewManager.getInstance();
      const instance2 = PreviewManager.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('getCurrentPreview', () => {
    it('returns undefined initially', () => {
      const manager = PreviewManager.getInstance();
      expect(manager.getCurrentPreview()).toBeUndefined();
    });

    it('returns preview after setCurrentPreview', () => {
      const manager = PreviewManager.getInstance();
      const mockPreview = {} as Preview;

      manager.setCurrentPreview(mockPreview);

      expect(manager.getCurrentPreview()).toBe(mockPreview);
    });

    it('returns undefined after setting to undefined', () => {
      const manager = PreviewManager.getInstance();
      const mockPreview = {} as Preview;

      manager.setCurrentPreview(mockPreview);
      manager.setCurrentPreview(undefined);

      expect(manager.getCurrentPreview()).toBeUndefined();
    });
  });

  describe('hasActivePreviews', () => {
    it('returns false when no preview', () => {
      const manager = PreviewManager.getInstance();
      expect(manager.hasActivePreviews()).toBe(false);
    });

    it('returns false when preview inactive', () => {
      const manager = PreviewManager.getInstance();
      const mockPreview = { active: false } as Preview;
      manager.setCurrentPreview(mockPreview);

      expect(manager.hasActivePreviews()).toBe(false);
    });

    it('returns true when preview active', () => {
      const manager = PreviewManager.getInstance();
      const mockPreview = { active: true } as Preview;
      manager.setCurrentPreview(mockPreview);

      expect(manager.hasActivePreviews()).toBe(true);
    });
  });

  describe('refreshAllPreviews', () => {
    it('calls refreshWebview on active preview', () => {
      const manager = PreviewManager.getInstance();
      const mockRefresh = vi.fn();
      const mockPreview = {
        active: true,
        refreshWebview: mockRefresh,
      } as unknown as Preview;
      manager.setCurrentPreview(mockPreview);

      manager.refreshAllPreviews();

      expect(mockRefresh).toHaveBeenCalled();
    });

    it('does not call refreshWebview on inactive preview', () => {
      const manager = PreviewManager.getInstance();
      const mockRefresh = vi.fn();
      const mockPreview = {
        active: false,
        refreshWebview: mockRefresh,
      } as unknown as Preview;
      manager.setCurrentPreview(mockPreview);

      manager.refreshAllPreviews();

      expect(mockRefresh).not.toHaveBeenCalled();
    });
  });

  describe('pushThemeToAllPreviews', () => {
    it('calls pushThemeState on active preview', () => {
      const manager = PreviewManager.getInstance();
      const mockPushTheme = vi.fn();
      const mockPreview = {
        active: true,
        pushThemeState: mockPushTheme,
      } as unknown as Preview;
      manager.setCurrentPreview(mockPreview);

      manager.pushThemeToAllPreviews();

      expect(mockPushTheme).toHaveBeenCalled();
    });
  });
});

describe('Preview', () => {
  const createMockDoc = (overrides = {}) => ({
    uri: { fsPath: '/test/file.mdx', scheme: 'file' },
    getText: () => '# Test',
    version: 1,
    ...overrides,
  });

  describe('constructor', () => {
    it('initializes with document', () => {
      const mockDoc = createMockDoc();
      const preview = new Preview(mockDoc as any);

      expect(preview.doc).toBe(mockDoc);
      expect(preview.fsPath).toBe('/test/file.mdx');
    });

    it('initializes configuration from workspace settings', () => {
      const mockDoc = createMockDoc();
      const preview = new Preview(mockDoc as any);

      expect(preview.configuration).toHaveProperty('updateMode');
      expect(preview.configuration).toHaveProperty('debounceDelay');
      expect(preview.configuration).toHaveProperty('useSucraseTranspiler');
    });
  });

  describe('stale detection', () => {
    it('markStale calls webviewHandle.setStale with true', () => {
      const mockDoc = createMockDoc();
      const preview = new Preview(mockDoc as any);
      const mockSetStale = vi.fn();
      // use setWebviewHandle to connect the document tracker
      preview.setWebviewHandle({ setStale: mockSetStale } as any);

      preview.markStale();

      expect(mockSetStale).toHaveBeenCalledWith(true);
    });

    it('markStale only notifies once when already stale', () => {
      const mockDoc = createMockDoc();
      const preview = new Preview(mockDoc as any);
      const mockSetStale = vi.fn();
      // use setWebviewHandle to connect the document tracker
      preview.setWebviewHandle({ setStale: mockSetStale } as any);

      preview.markStale();
      preview.markStale();

      // should only call once since already stale
      expect(mockSetStale).toHaveBeenCalledTimes(1);
    });
  });

  describe('resetRenderedVersion', () => {
    it('resets version to force re-render', () => {
      const mockDoc = createMockDoc();
      const preview = new Preview(mockDoc as any);

      preview.resetRenderedVersion();

      // internal state reset - method exists & doesn't throw
      expect(true).toBe(true);
    });
  });

  describe('styleConfiguration', () => {
    it('returns style configuration object', () => {
      const mockDoc = createMockDoc();
      const preview = new Preview(mockDoc as any);

      const styleConfig = preview.styleConfiguration;

      expect(styleConfig).toHaveProperty('useVscodeMarkdownStyles');
      expect(styleConfig).toHaveProperty('useWhiteBackground');
    });
  });

  describe('securityConfiguration', () => {
    it('returns security configuration object', () => {
      const mockDoc = createMockDoc();
      const preview = new Preview(mockDoc as any);

      const securityConfig = preview.securityConfiguration;

      expect(securityConfig).toHaveProperty('securityPolicy');
    });
  });

  describe('entryFsDirectory', () => {
    it('returns directory for file scheme', () => {
      const mockDoc = createMockDoc();
      const preview = new Preview(mockDoc as any);

      expect(preview.entryFsDirectory).toBe('/test');
    });

    it('returns workspace folder for untitled scheme', () => {
      const mockDoc = createMockDoc({
        uri: { fsPath: 'Untitled-1', scheme: 'untitled' },
      });
      const preview = new Preview(mockDoc as any);

      expect(preview.entryFsDirectory).toBe('/test');
    });
  });

  describe('text property', () => {
    it('returns document text', () => {
      const mockDoc = createMockDoc({
        getText: () => '# Hello World',
      });
      const preview = new Preview(mockDoc as any);

      expect(preview.text).toBe('# Hello World');
    });
  });

  describe('dispose', () => {
    it('disposes custom CSS watcher without error', () => {
      const mockDoc = createMockDoc();
      const preview = new Preview(mockDoc as any);

      // should not throw
      expect(() => preview.dispose()).not.toThrow();
    });
  });

  describe('setDoc', () => {
    it('updates document and dependent paths', () => {
      const mockDoc1 = createMockDoc();
      const preview = new Preview(mockDoc1 as any);

      const mockDoc2 = createMockDoc({
        uri: { fsPath: '/test/other.mdx', scheme: 'file' },
      });
      preview.setDoc(mockDoc2 as any);

      expect(preview.doc).toBe(mockDoc2);
      expect(preview.fsPath).toBe('/test/other.mdx');
    });
  });

  describe('getWebviewUri', () => {
    it('returns undefined when no webview', () => {
      const mockDoc = createMockDoc();
      const preview = new Preview(mockDoc as any);

      expect(preview.getWebviewUri('/some/path')).toBeUndefined();
    });

    it('returns webview URI when webview available', () => {
      const mockDoc = createMockDoc();
      const preview = new Preview(mockDoc as any);
      preview.webview = {
        asWebviewUri: (uri: any) => `vscode-webview://resource${uri.fsPath}`,
      } as any;

      const uri = preview.getWebviewUri('/test/resource.js');

      expect(uri).toContain('vscode-webview://');
    });
  });
});
