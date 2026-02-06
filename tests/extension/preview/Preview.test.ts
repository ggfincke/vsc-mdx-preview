// tests/extension/preview/Preview.test.ts
// unit tests for Preview composition, delegation, and refresh wiring

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const stateInstances: any[] = [];
  const initializerInstances: any[] = [];
  const documentHandlerInstances: any[] = [];
  const configInstances: any[] = [];
  const webviewBridgeInstances: any[] = [];
  const evaluatorInstances: any[] = [];

  const mockResolveHandshake = vi.fn();
  const mockRefreshPanel = vi.fn();
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
    invalidate: vi.fn(async () => {}),
    clearAllCaches: vi.fn(async () => {}),
  };

  return {
    stateInstances,
    initializerInstances,
    documentHandlerInstances,
    configInstances,
    webviewBridgeInstances,
    evaluatorInstances,
    mockResolveHandshake,
    mockRefreshPanel,
    mockPreviewManager,
    mockWatcherManager,
    mockWebviewHandle,
  };
});

vi.mock('../../../packages/extension/logging', () => ({
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

vi.mock('../../../packages/extension/preview/webview-manager', () => ({
  refreshPanel: (...args: any[]) => mocks.mockRefreshPanel(...args),
}));

vi.mock('../../../packages/extension/preview/PreviewState', () => ({
  PreviewState: class MockPreviewState {
    performanceObserver = undefined;
    evaluationDuration = 0;
    previewDuration = 0;
    nextTailwindRequestId = vi.fn(() => 42);
    isTailwindRequestCurrent = vi.fn((id: number) => id === 42);
    setupPerformanceObserver = vi.fn();
    dispose = vi.fn();

    constructor() {
      mocks.stateInstances.push(this);
    }
  },
}));

vi.mock('../../../packages/extension/preview/PreviewInitializer', () => ({
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
}));

vi.mock('../../../packages/extension/preview/PreviewDocumentHandler', () => ({
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
}));

vi.mock('../../../packages/extension/preview/PreviewConfiguration', () => ({
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
}));

vi.mock('../../../packages/extension/preview/PreviewWebviewBridge', () => ({
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
}));

vi.mock('../../../packages/extension/preview/PreviewEvaluator', () => ({
  PreviewEvaluator: class MockPreviewEvaluator {
    updateWebview = vi.fn(async () => {});

    constructor() {
      mocks.evaluatorInstances.push(this);
    }
  },
}));

import { Preview } from '../../../packages/extension/preview/Preview';

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
    mocks.stateInstances.length = 0;
    mocks.initializerInstances.length = 0;
    mocks.documentHandlerInstances.length = 0;
    mocks.configInstances.length = 0;
    mocks.webviewBridgeInstances.length = 0;
    mocks.evaluatorInstances.length = 0;
    mocks.mockPreviewManager.getCurrentPreview.mockReturnValue(undefined);
  });

  it('constructor wires modules, sets doc, and starts watchers', async () => {
    const doc = createDoc();
    new Preview(doc);

    const initializer = last(mocks.initializerInstances);
    const documentHandler = last(mocks.documentHandlerInstances);
    const state = last(mocks.stateInstances);

    expect(initializer.createHandshake).toHaveBeenCalledTimes(1);
    expect(initializer.createWatchers).toHaveBeenCalledWith(
      '/workspace/custom.css',
      expect.any(Function),
      expect.any(Promise)
    );
    expect(documentHandler.setDoc).toHaveBeenCalledWith(
      doc,
      mocks.mockWatcherManager
    );
    await vi.waitFor(() => {
      expect(initializer.startWatchers).toHaveBeenCalledWith(
        mocks.mockWatcherManager
      );
    });
    expect(state.setupPerformanceObserver).toHaveBeenCalledTimes(1);
  });

  it('webview setter updates bridge and stores value', () => {
    const preview = new Preview(createDoc());
    const bridge = last(mocks.webviewBridgeInstances);
    const webview = { asWebviewUri: vi.fn() } as any;

    preview.webview = webview;

    expect(preview.webview).toBe(webview);
    expect(bridge.setWebview).toHaveBeenCalledWith(webview);
  });

  it('completeHandshake and cancelHandshakeTimeout delegate to initializer', () => {
    const preview = new Preview(createDoc());
    const initializer = last(mocks.initializerInstances);

    preview.completeHandshake();
    preview.cancelHandshakeTimeout();

    expect(mocks.mockResolveHandshake).toHaveBeenCalledTimes(1);
    expect(initializer.cancelHandshakeTimeout).toHaveBeenCalledTimes(1);
  });

  it('updateWebview delegates to evaluator', async () => {
    const preview = new Preview(createDoc());
    const evaluator = last(mocks.evaluatorInstances);

    await preview.updateWebview(true);

    expect(evaluator.updateWebview).toHaveBeenCalledWith(true);
  });

  it('updateTailwindWatchFiles delegates and callback forces update', async () => {
    const preview = new Preview(createDoc());
    const initializer = last(mocks.initializerInstances);
    const evaluator = last(mocks.evaluatorInstances);

    preview.updateTailwindWatchFiles(['/workspace/tailwind.config.ts']);

    expect(initializer.setupTailwindConfigWatcher).toHaveBeenCalledWith(
      mocks.mockWatcherManager,
      ['/workspace/tailwind.config.ts'],
      expect.any(Function)
    );

    const callback = initializer.setupTailwindConfigWatcher.mock.calls[0][2];
    await callback(['/workspace/tailwind.config.ts']);

    expect(evaluator.updateWebview).toHaveBeenCalledWith(true);
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

  it('handleDidChangeTextDocument passes composed callbacks to document handler', async () => {
    const preview = new Preview(createDoc());
    const documentHandler = last(mocks.documentHandlerInstances);
    const bridge = last(mocks.webviewBridgeInstances);
    const config = last(mocks.configInstances);

    preview.active = true;
    const editDoc = createDoc({
      version: 2,
      getText: () => '# edit',
    });

    await preview.handleDidChangeTextDocument('/workspace/dep.ts', editDoc);

    const call = documentHandler.handleDidChangeTextDocument.mock.calls[0];
    expect(call[0]).toBe('/workspace/dep.ts');
    expect(call[1]).toBe(editDoc);
    expect(call[2]).toBe(true);
    expect(call[3]).toBe('onType');

    const markStale = call[4] as () => void;
    const invalidate = call[5] as (fsPath: string) => Promise<void>;
    const debouncedUpdate = call[6] as () => void;

    markStale();
    await invalidate('/workspace/dep.ts');
    debouncedUpdate();

    expect(documentHandler.markStale).toHaveBeenCalledWith(
      mocks.mockWatcherManager
    );
    expect(bridge.invalidate).toHaveBeenCalledWith('/workspace/dep.ts');
    expect(config.debouncedUpdateWebview).toHaveBeenCalledTimes(1);
  });

  it('handleDidSaveTextDocument passes composed callbacks to document handler', async () => {
    const preview = new Preview(createDoc());
    const documentHandler = last(mocks.documentHandlerInstances);
    const bridge = last(mocks.webviewBridgeInstances);
    const evaluator = last(mocks.evaluatorInstances);

    preview.active = true;
    await preview.handleDidSaveTextDocument('/workspace/dep.ts');

    const call = documentHandler.handleDidSaveTextDocument.mock.calls[0];
    expect(call[0]).toBe('/workspace/dep.ts');
    expect(call[1]).toBe(true);
    expect(call[2]).toBe('onType');

    const markStale = call[3] as () => void;
    const invalidate = call[4] as (fsPath: string) => Promise<void>;
    const update = call[5] as () => Promise<void>;

    markStale();
    await invalidate('/workspace/dep.ts');
    await update();

    expect(documentHandler.markStale).toHaveBeenCalledWith(
      mocks.mockWatcherManager
    );
    expect(bridge.invalidate).toHaveBeenCalledWith('/workspace/dep.ts');
    expect(evaluator.updateWebview).toHaveBeenCalledWith(false);
  });

  it('dispose releases state and watcher manager resources', () => {
    const preview = new Preview(createDoc());
    const state = last(mocks.stateInstances);

    preview.dispose();

    expect(state.dispose).toHaveBeenCalledTimes(1);
    expect(mocks.mockWatcherManager.dispose).toHaveBeenCalledTimes(1);
  });
});
