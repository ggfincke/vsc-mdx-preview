// tests/extension/preview/Preview.test.ts
// unit tests for Preview composition, delegation, & refresh wiring

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const initializerInstances: any[] = [];
  const documentHandlerInstances: any[] = [];
  const configInstances: any[] = [];
  const webviewBridgeInstances: any[] = [];

  const mockResolveHandshake = vi.fn();
  const mockRefreshPanel = vi.fn();
  const mockEvaluateInWebview = vi.fn(async () => {});
  const mockReadFileAsync = vi.fn(async () => '# saved content');
  const mockPreviewManager = {
    getCurrentPreview: vi.fn(),
  };

  const mockWatcherManager = {
    dispose: vi.fn(),
    get: vi.fn(),
    register: vi.fn(),
    unregister: vi.fn(),
    startAll: vi.fn(async () => {}),
    waitForGate: vi.fn(async () => {}),
  };

  const mockWebviewHandle = {
    setTheme: vi.fn(),
    setStale: vi.fn(),
    setCustomCss: vi.fn(),
    setTailwindCss: vi.fn(),
    setTailwindBrowserCss: vi.fn(),
    invalidate: vi.fn(async () => {}),
    clearAllCaches: vi.fn(async () => {}),
  };

  return {
    initializerInstances,
    documentHandlerInstances,
    configInstances,
    webviewBridgeInstances,
    mockResolveHandshake,
    mockRefreshPanel,
    mockEvaluateInWebview,
    mockReadFileAsync,
    mockPreviewManager,
    mockWatcherManager,
    mockWebviewHandle,
  };
});

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
  '../../../packages/extension-host/src/features/preview/webview-manager',
  () => ({
    refreshPanel: (...args: any[]) => mocks.mockRefreshPanel(...args),
  })
);

vi.mock(
  '../../../packages/extension-host/src/features/preview/evaluate-in-webview',
  () => ({
    default: (...args: any[]) => mocks.mockEvaluateInWebview(...args),
  })
);

vi.mock('../../../packages/extension-host/src/shared/utils/file-utils', () => ({
  readFileAsync: (...args: any[]) => mocks.mockReadFileAsync(...args),
}));

vi.mock(
  '../../../packages/extension-host/src/features/preview/PreviewInitializer',
  () => ({
    PreviewInitializer: class MockPreviewInitializer {
      cancelHandshakeTimeout = vi.fn();
      createHandshake = vi.fn(() => ({
        promise: Promise.resolve(),
        resolve: mocks.mockResolveHandshake,
      }));
      createWatchers = vi.fn(() => mocks.mockWatcherManager);
      startWatchers = vi.fn(async () => {});
      setupConfigWatcher = vi.fn();
      setupTailwindConfigWatcher = vi.fn();
      setupCustomCssWatcher = vi.fn();

      constructor() {
        mocks.initializerInstances.push(this);
      }
    },
  })
);

vi.mock(
  '../../../packages/extension-host/src/features/preview/PreviewDocumentHandler',
  () => ({
    PreviewDocumentHandler: class MockPreviewDocumentHandler {
      private _doc: any;
      editingDoc = undefined;
      dependentFsPaths = new Set<string>();
      fsPath = '';
      text = '';
      entryFsDirectory: string | null = '/workspace';
      typescriptConfiguration = undefined;
      mdxPreviewConfig = undefined;

      setDoc = vi.fn((doc: any) => {
        this._doc = doc;
        this.fsPath = doc.uri.fsPath;
        this.text = doc.getText();
        this.dependentFsPaths = new Set([doc.uri.fsPath]);
      });

      setActions = vi.fn();
      reloadMdxConfig = vi.fn();
      resetRenderedVersion = vi.fn();
      markStale = vi.fn();
      updateDependencies = vi.fn();
      handleDidChangeTextDocument = vi.fn(async () => {});
      handleDidSaveTextDocument = vi.fn(async () => {});

      get doc() {
        return this._doc;
      }

      constructor() {
        mocks.documentHandlerInstances.push(this);
      }
    },
  })
);

vi.mock(
  '../../../packages/extension-host/src/features/preview/PreviewConfiguration',
  () => ({
    PreviewConfiguration: class MockPreviewConfiguration {
      configuration = {
        updateMode: 'onType',
        customCss: '/workspace/custom.css',
      } as any;
      styleConfiguration = {
        useVscodeMarkdownStyles: true,
        useWhiteBackground: false,
      };
      securityConfiguration = { securityPolicy: 'strict' };
      debouncedUpdateWebview = vi.fn();
      updateConfiguration = vi.fn(() => ({
        needsWebviewRefresh: false,
        needsDebounceRecreate: false,
        needsCssWatcherUpdate: false,
        oldCssPath: '/workspace/custom.css',
      }));

      constructor(_docUri: any, _updateWebviewFn: () => void) {
        mocks.configInstances.push(this);
      }
    },
  })
);

vi.mock(
  '../../../packages/extension-host/src/features/preview/PreviewWebviewBridge',
  () => ({
    PreviewWebviewBridge: class MockPreviewWebviewBridge {
      setWebview = vi.fn();
      setWebviewHandle = vi.fn();
      onWebviewReady = vi.fn();
      pushThemeState = vi.fn();
      clearAllCaches = vi.fn(async () => {});
      invalidate = vi.fn(async () => {});
      getWebviewUri = vi.fn((fsPath: string) => `webview://${fsPath}`);
      getHandle = vi.fn(() => mocks.mockWebviewHandle);

      constructor() {
        mocks.webviewBridgeInstances.push(this);
      }
    },
  })
);

import { Preview } from '../../../packages/extension-host/src/features/preview/Preview';

function createDoc(overrides: Partial<any> = {}): any {
  return {
    uri: {
      fsPath: '/workspace/doc.mdx',
      scheme: 'file',
      toString: () => 'file:///workspace/doc.mdx',
    },
    version: 1,
    getText: () => '# doc',
    ...overrides,
  };
}

function last<T>(items: T[]): T {
  return items[items.length - 1]!;
}

describe('Preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.initializerInstances.length = 0;
    mocks.documentHandlerInstances.length = 0;
    mocks.configInstances.length = 0;
    mocks.webviewBridgeInstances.length = 0;
    mocks.mockPreviewManager.getCurrentPreview.mockReturnValue(undefined);
  });

  it('constructor wires modules, sets doc, & starts watchers', async () => {
    const doc = createDoc();
    new Preview(doc);

    const initializer = last(mocks.initializerInstances);
    const documentHandler = last(mocks.documentHandlerInstances);

    expect(initializer.createHandshake).toHaveBeenCalledTimes(1);
    expect(initializer.createWatchers).toHaveBeenCalledWith(
      '/workspace/custom.css',
      expect.any(Function),
      expect.any(Promise)
    );
    expect(documentHandler.setActions).toHaveBeenCalledWith({
      markStale: expect.any(Function),
      invalidate: expect.any(Function),
      debouncedUpdate: expect.any(Function),
      updateWebview: expect.any(Function),
    });
    expect(documentHandler.setDoc).toHaveBeenCalledWith(
      doc,
      mocks.mockWatcherManager
    );
    await vi.waitFor(() => {
      expect(initializer.startWatchers).toHaveBeenCalledWith(
        mocks.mockWatcherManager
      );
    });
  });

  it('webview setter updates bridge & stores value', () => {
    const preview = new Preview(createDoc());
    const bridge = last(mocks.webviewBridgeInstances);
    const webview = { asWebviewUri: vi.fn() } as any;

    preview.webview = webview;

    expect(preview.webview).toBe(webview);
    expect(bridge.setWebview).toHaveBeenCalledWith(webview);
  });

  it('completeHandshake & cancelHandshakeTimeout delegate correctly', () => {
    const preview = new Preview(createDoc());
    const initializer = last(mocks.initializerInstances);

    preview.completeHandshake();
    preview.cancelHandshakeTimeout();

    expect(mocks.mockResolveHandshake).toHaveBeenCalledTimes(1);
    expect(initializer.cancelHandshakeTimeout).toHaveBeenCalledTimes(1);
  });

  it('updateWebview calls evaluateInWebview w/ current text', async () => {
    const preview = new Preview(createDoc());

    await preview.updateWebview(true);

    expect(mocks.mockEvaluateInWebview).toHaveBeenCalledWith(
      preview,
      '# doc',
      '/workspace/doc.mdx'
    );
  });

  it('updateWebview skips if version already rendered', async () => {
    const mockDocTracker = {
      hasRenderedVersion: vi.fn(() => true),
      markRendered: vi.fn(),
    };
    mocks.mockWatcherManager.get.mockReturnValue(mockDocTracker);

    const preview = new Preview(createDoc());
    await preview.updateWebview(false);

    expect(mocks.mockEvaluateInWebview).not.toHaveBeenCalled();
    mocks.mockWatcherManager.get.mockReturnValue(undefined);
  });

  it('updateTailwindWatchFiles delegates & callback forces update', async () => {
    const preview = new Preview(createDoc());
    const initializer = last(mocks.initializerInstances);

    preview.updateTailwindWatchFiles(['/workspace/tailwind.config.ts']);

    expect(initializer.setupTailwindConfigWatcher).toHaveBeenCalledWith(
      mocks.mockWatcherManager,
      ['/workspace/tailwind.config.ts'],
      expect.any(Function)
    );

    const callback = initializer.setupTailwindConfigWatcher.mock.calls[0][2];
    await callback(['/workspace/tailwind.config.ts']);

    expect(mocks.mockEvaluateInWebview).toHaveBeenCalled();
  });

  it('updateConfiguration updates CSS watcher when flags request it', () => {
    const preview = new Preview(createDoc());
    const initializer = last(mocks.initializerInstances);
    const config = last(mocks.configInstances);

    config.updateConfiguration.mockReturnValue({
      needsWebviewRefresh: false,
      needsDebounceRecreate: false,
      needsCssWatcherUpdate: true,
      oldCssPath: '/workspace/old.css',
    });

    preview.updateConfiguration();

    expect(initializer.setupCustomCssWatcher).toHaveBeenCalledWith(
      mocks.mockWatcherManager,
      '/workspace/custom.css',
      '/workspace',
      mocks.mockWebviewHandle
    );
    expect(mocks.mockRefreshPanel).not.toHaveBeenCalled();
  });

  it('handleDidChangeTextDocument passes args to document handler', async () => {
    const preview = new Preview(createDoc());
    const documentHandler = last(mocks.documentHandlerInstances);

    preview.active = true;
    const editDoc = createDoc({
      version: 2,
      getText: () => '# edit',
    });

    await preview.handleDidChangeTextDocument('/workspace/dep.ts', editDoc);

    expect(documentHandler.handleDidChangeTextDocument).toHaveBeenCalledWith(
      '/workspace/dep.ts',
      editDoc,
      true,
      'onType'
    );
  });

  it('handleDidSaveTextDocument passes args to document handler', async () => {
    const preview = new Preview(createDoc());
    const documentHandler = last(mocks.documentHandlerInstances);

    preview.active = true;
    await preview.handleDidSaveTextDocument('/workspace/dep.ts');

    expect(documentHandler.handleDidSaveTextDocument).toHaveBeenCalledWith(
      '/workspace/dep.ts',
      true,
      'onType'
    );
  });

  it('nextTailwindRequestId returns incrementing values', () => {
    const preview = new Preview(createDoc());

    expect(preview.nextTailwindRequestId()).toBe(1);
    expect(preview.nextTailwindRequestId()).toBe(2);
    expect(preview.nextTailwindRequestId()).toBe(3);
  });

  it('isTailwindRequestCurrent checks against latest ID', () => {
    const preview = new Preview(createDoc());

    const id = preview.nextTailwindRequestId();
    expect(preview.isTailwindRequestCurrent(id)).toBe(true);
    expect(preview.isTailwindRequestCurrent(id - 1)).toBe(false);

    const id2 = preview.nextTailwindRequestId();
    expect(preview.isTailwindRequestCurrent(id)).toBe(false);
    expect(preview.isTailwindRequestCurrent(id2)).toBe(true);
  });

  it('setTailwindBrowserRuntimeEnabled reports changes only on transitions', () => {
    const preview = new Preview(createDoc());

    expect(preview.setTailwindBrowserRuntimeEnabled(true)).toBe(true);
    expect(preview.isTailwindBrowserRuntimeEnabled()).toBe(true);
    expect(preview.setTailwindBrowserRuntimeEnabled(true)).toBe(false);
    expect(preview.setTailwindBrowserRuntimeEnabled(false)).toBe(true);
    expect(preview.isTailwindBrowserRuntimeEnabled()).toBe(false);
  });

  it('markTailwindFallbackReason coalesces duplicate reasons', () => {
    const preview = new Preview(createDoc());

    expect(
      preview.markTailwindFallbackReason('tailwind.config.js detected')
    ).toBe(true);
    expect(
      preview.markTailwindFallbackReason('tailwind.config.js detected')
    ).toBe(false);
    preview.clearTailwindFallbackReason();
    expect(
      preview.markTailwindFallbackReason('tailwind.config.js detected')
    ).toBe(true);
  });

  it('dispose releases watcher manager resources', () => {
    const preview = new Preview(createDoc());

    preview.dispose();

    expect(mocks.mockWatcherManager.dispose).toHaveBeenCalledTimes(1);
  });
});
