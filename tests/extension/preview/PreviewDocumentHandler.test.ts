// tests/extension/preview/PreviewDocumentHandler.test.ts
// document state management — update mode dispatch & directory resolution

import { describe, it, expect, beforeEach, vi } from 'vitest';

// mock configuration resolution modules
const mockFindTsConfig = vi.fn();
const mockResolveTypescriptConfig = vi.fn();
const mockResolveConfigFn = vi.fn();

vi.mock(
  '../../../packages/extension-host/src/features/preview/configuration',
  () => ({
    findTsConfig: (...args: unknown[]) => mockFindTsConfig(...args),
    resolveTypescriptConfig: (...args: unknown[]) =>
      mockResolveTypescriptConfig(...args),
    resolveConfig: (...args: unknown[]) => mockResolveConfigFn(...args),
  })
);

// mock watchers module
vi.mock(
  '../../../packages/extension-host/src/features/preview/watchers',
  () => ({
    DocumentTracker: class {},
    DependencyWatcher: class {},
    WatcherManager: class {},
  })
);

import { PreviewDocumentHandler } from '../../../packages/extension-host/src/features/preview/PreviewDocumentHandler';

// create a mock vscode TextDocument
function createDoc(fsPath: string, scheme = 'file') {
  return {
    uri: { scheme, fsPath, toString: () => `${scheme}://${fsPath}` },
    getText: vi.fn(() => '# Test'),
    version: 1,
  };
}

// create a mock WatcherManager
function createWatcherManager() {
  const mockDepWatcher = {
    setDocumentDir: vi.fn(),
    clear: vi.fn(),
    updateDependencies: vi.fn(),
  };
  const mockDocTracker = {
    resetRenderedVersion: vi.fn(),
    markStale: vi.fn(),
    setNotifier: vi.fn(),
  };

  return {
    get: vi.fn((name: string) => {
      if (name === 'dependency') {
        return mockDepWatcher;
      }
      if (name === 'document') {
        return mockDocTracker;
      }
      return undefined;
    }),
    mockDepWatcher,
    mockDocTracker,
  };
}

// create mock PreviewActions
function createActions() {
  return {
    markStale: vi.fn(),
    invalidate: vi.fn(async () => {}),
    debouncedUpdate: vi.fn(),
    updateWebview: vi.fn(async () => {}),
  };
}

describe('PreviewDocumentHandler', () => {
  let handler: PreviewDocumentHandler;
  let wm: ReturnType<typeof createWatcherManager>;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new PreviewDocumentHandler();
    wm = createWatcherManager();
    mockFindTsConfig.mockReturnValue(undefined);
    mockResolveConfigFn.mockReturnValue(undefined);
  });

  describe('entryFsDirectory', () => {
    it('returns dirname for file:// documents', () => {
      const doc = createDoc('/workspace/src/doc.mdx');
      handler.setDoc(doc as any, wm as any);

      expect(handler.entryFsDirectory).toBe('/workspace/src');
    });

    it('returns null for unknown schemes', () => {
      const doc = createDoc('/workspace/doc.mdx', 'vscode-notebook');
      handler.setDoc(doc as any, wm as any);

      expect(handler.entryFsDirectory).toBeNull();
    });
  });

  describe('setDoc()', () => {
    it('initializes dependent paths w/ document fsPath', () => {
      const doc = createDoc('/workspace/doc.mdx');
      handler.setDoc(doc as any, wm as any);

      expect(handler.dependentFsPaths.has('/workspace/doc.mdx')).toBe(true);
    });

    it('resolves TypeScript config when tsconfig found', () => {
      mockFindTsConfig.mockReturnValue('/workspace/tsconfig.json');
      mockResolveTypescriptConfig.mockReturnValue({
        configPath: '/workspace/tsconfig.json',
        paths: {},
      });

      const doc = createDoc('/workspace/doc.mdx');
      handler.setDoc(doc as any, wm as any);

      expect(handler.typescriptConfiguration).toEqual({
        configPath: '/workspace/tsconfig.json',
        paths: {},
      });
    });

    it('resolves MDX preview config for file:// documents', () => {
      mockResolveConfigFn.mockReturnValue({
        config: { plugins: {} },
        configPath: '/workspace/.mdx-previewrc.json',
        configDir: '/workspace',
      });

      const doc = createDoc('/workspace/doc.mdx');
      handler.setDoc(doc as any, wm as any);

      expect(handler.mdxPreviewConfig).toBeDefined();
      expect(handler.mdxPreviewConfig!.configPath).toBe(
        '/workspace/.mdx-previewrc.json'
      );
    });

    it('skips MDX config resolution for non-file schemes', () => {
      const doc = createDoc('/workspace/doc.mdx', 'untitled');
      handler.setDoc(doc as any, wm as any);

      expect(handler.mdxPreviewConfig).toBeUndefined();
      expect(mockResolveConfigFn).not.toHaveBeenCalled();
    });

    it('updates dependency watcher', () => {
      const doc = createDoc('/workspace/doc.mdx');
      handler.setDoc(doc as any, wm as any);

      expect(wm.mockDepWatcher.setDocumentDir).toHaveBeenCalledWith(
        '/workspace'
      );
      expect(wm.mockDepWatcher.clear).toHaveBeenCalled();
    });
  });

  describe('handleDidChangeTextDocument()', () => {
    beforeEach(() => {
      const doc = createDoc('/workspace/doc.mdx');
      handler.setDoc(doc as any, wm as any);
    });

    it('skips inactive previews', async () => {
      const actions = createActions();
      handler.setActions(actions);

      await handler.handleDidChangeTextDocument(
        '/workspace/doc.mdx',
        createDoc('/workspace/doc.mdx') as any,
        false,
        'onType'
      );

      expect(actions.markStale).not.toHaveBeenCalled();
    });

    it('skips paths not in dependentFsPaths', async () => {
      const actions = createActions();
      handler.setActions(actions);

      await handler.handleDidChangeTextDocument(
        '/workspace/other.mdx',
        createDoc('/workspace/other.mdx') as any,
        true,
        'onType'
      );

      expect(actions.markStale).not.toHaveBeenCalled();
    });

    it('onType mode: marks stale & calls debouncedUpdate', async () => {
      const actions = createActions();
      handler.setActions(actions);

      await handler.handleDidChangeTextDocument(
        '/workspace/doc.mdx',
        createDoc('/workspace/doc.mdx') as any,
        true,
        'onType'
      );

      expect(actions.markStale).toHaveBeenCalled();
      expect(actions.debouncedUpdate).toHaveBeenCalled();
    });

    it('onSave mode: marks stale only', async () => {
      const actions = createActions();
      handler.setActions(actions);

      await handler.handleDidChangeTextDocument(
        '/workspace/doc.mdx',
        createDoc('/workspace/doc.mdx') as any,
        true,
        'onSave'
      );

      expect(actions.markStale).toHaveBeenCalled();
      expect(actions.debouncedUpdate).not.toHaveBeenCalled();
    });
  });

  describe('handleDidSaveTextDocument()', () => {
    beforeEach(() => {
      const doc = createDoc('/workspace/doc.mdx');
      handler.setDoc(doc as any, wm as any);
    });

    it('skips inactive previews', async () => {
      const actions = createActions();
      handler.setActions(actions);

      await handler.handleDidSaveTextDocument(
        '/workspace/doc.mdx',
        false,
        'onSave'
      );

      expect(actions.updateWebview).not.toHaveBeenCalled();
    });

    it('manual mode: marks stale only', async () => {
      const actions = createActions();
      handler.setActions(actions);

      await handler.handleDidSaveTextDocument(
        '/workspace/doc.mdx',
        true,
        'manual'
      );

      expect(actions.markStale).toHaveBeenCalled();
      expect(actions.updateWebview).not.toHaveBeenCalled();
    });

    it('onSave mode: updates webview', async () => {
      const actions = createActions();
      handler.setActions(actions);

      await handler.handleDidSaveTextDocument(
        '/workspace/doc.mdx',
        true,
        'onSave'
      );

      expect(actions.updateWebview).toHaveBeenCalled();
    });

    it('invalidates dependency before updating webview', async () => {
      // add a dependent file
      handler.dependentFsPaths.add('/workspace/component.tsx');
      const actions = createActions();
      handler.setActions(actions);

      await handler.handleDidSaveTextDocument(
        '/workspace/component.tsx',
        true,
        'onSave'
      );

      expect(actions.invalidate).toHaveBeenCalledWith(
        '/workspace/component.tsx'
      );
      expect(actions.updateWebview).toHaveBeenCalled();
    });
  });
});
