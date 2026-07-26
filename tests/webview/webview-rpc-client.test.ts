// tests/webview/webview-rpc-client.test.ts
// integration-style tests for webview-rpc-client composition root
// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRpcMessageQueue } from '../../packages/webview-client/src/platform/rpc/rpc-message-queue';

const {
  mockWrap,
  mockExpose,
  mockExtensionHandle,
  acquireMock,
  mockPostMessage,
  mockGetState,
  mockSetState,
  mockLoadModuleSystem,
  mockEnsureFrameworkShimsLoaded,
} = vi.hoisted(() => {
  const mockPostMessage = vi.fn();
  const mockGetState = vi.fn();
  const mockSetState = vi.fn();
  const mockExtensionHandle = {
    handshake: vi.fn(),
    reportPerformance: vi.fn(),
    fetch: vi.fn(async () => undefined),
    openSettings: vi.fn(),
    manageTrust: vi.fn(),
    openExternal: vi.fn(),
    openDocument: vi.fn(async () => {}),
    openPreview: vi.fn(async () => {}),
    reportPreviewSourceLine: vi.fn(async () => 'accepted'),
    renderPlantUml: vi.fn(async () => undefined),
  };
  const mockWrap = vi.fn(() => mockExtensionHandle);
  const mockExpose = vi.fn();
  const acquireMock = vi.fn(() => ({
    postMessage: mockPostMessage,
    getState: mockGetState,
    setState: mockSetState,
  }));
  const mockEnsureFrameworkShimsLoaded = vi.fn(async () => undefined);
  const mockLoadModuleSystem = vi.fn(async () => ({
    ensureFrameworkShimsLoaded: mockEnsureFrameworkShimsLoaded,
  }));

  return {
    mockWrap,
    mockExpose,
    mockExtensionHandle,
    acquireMock,
    mockPostMessage,
    mockGetState,
    mockSetState,
    mockLoadModuleSystem,
    mockEnsureFrameworkShimsLoaded,
  };
});

vi.mock('comlink', () => ({
  wrap: (...args: unknown[]) => mockWrap(...args),
  expose: (...args: unknown[]) => mockExpose(...args),
}));

vi.mock(
  '../../packages/webview-client/src/platform/rpc/module-system-loader',
  () => ({
    loadModuleSystem: () => mockLoadModuleSystem(),
  })
);

describe('webview-rpc-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    document.head.innerHTML =
      '<meta name="mdx-preview-handshake-id" content="42">';
    (globalThis as any).acquireVsCodeApi = acquireMock;
  });

  afterEach(() => {
    document.head.innerHTML = '';
    delete (globalThis as any).acquireVsCodeApi;
  });

  it('imports without requiring global acquireVsCodeApi at module load time', async () => {
    delete (globalThis as any).acquireVsCodeApi;

    await expect(
      import('../../packages/webview-client/src/platform/rpc/webview-rpc-client')
    ).resolves.toBeTruthy();
  });

  it('bootstraps RPC and exposes framework shim load failures', async () => {
    const module =
      await import('../../packages/webview-client/src/platform/rpc/webview-rpc-client');

    module.initRPCWebviewSide();

    expect(acquireMock).toHaveBeenCalledTimes(1);
    expect(mockWrap).toHaveBeenCalledTimes(1);
    expect(mockExpose).toHaveBeenCalledTimes(1);
    expect(mockExtensionHandle.handshake).toHaveBeenCalledTimes(1);
    expect(mockExtensionHandle.handshake).toHaveBeenCalledWith(42);

    module.ExtensionHandle.openExternal('https://example.com');
    expect(mockExtensionHandle.openExternal).toHaveBeenCalledWith(
      'https://example.com'
    );

    await expect(
      module.ExtensionHandle.reportPreviewSourceLine(12)
    ).resolves.toBe('accepted');
    expect(mockExtensionHandle.reportPreviewSourceLine).toHaveBeenCalledWith(
      12
    );

    const exposedHandle = mockExpose.mock.calls[0][0] as {
      setFramework: (framework: string) => Promise<void>;
    };
    mockEnsureFrameworkShimsLoaded.mockRejectedValueOnce(
      new Error('framework shim failed')
    );
    await expect(exposedHandle.setFramework('docusaurus')).rejects.toThrow(
      'framework shim failed'
    );
  });

  it('flushes buffered state and keeps only the latest preview outcome', async () => {
    const module =
      await import('../../packages/webview-client/src/platform/rpc/webview-rpc-client');

    module.initRPCWebviewSide();

    const exposedHandle = mockExpose.mock.calls[0][0] as {
      setTrustState: (state: unknown) => void;
      updatePreviewSafe: (html: string) => void;
      setRuntimeConfig: (config: unknown) => void;
      adjustZoom: (delta: number) => void;
      resetZoom: () => void;
    };

    exposedHandle.setTrustState({
      workspaceTrusted: true,
      scriptsEnabled: true,
      canExecute: true,
      openMdxLinksInPreview: false,
    });
    exposedHandle.updatePreviewSafe('<p>safe</p>');
    exposedHandle.setRuntimeConfig({
      sourceLineHighlight: true,
      sourceLineHighlightColor: 'dependent',
      scrollSync: 'off',
      shimSideRail: true,
    });
    exposedHandle.setRuntimeConfig({
      sourceLineHighlight: false,
      sourceLineHighlightColor: 'white',
      scrollSync: 'previewToEditor',
      shimSideRail: false,
    });
    exposedHandle.adjustZoom(0.1);
    exposedHandle.adjustZoom(0.1);
    exposedHandle.resetZoom();
    exposedHandle.adjustZoom(-0.1);

    const zoomEvents: string[] = [];
    const handlers = {
      setTrustState: vi.fn(),
      setSafeContent: vi.fn(),
      setTrustedContent: vi.fn(),
      setError: vi.fn(),
      setStale: vi.fn(),
      setRuntimeConfig: vi.fn(),
      adjustZoom: vi.fn((delta: number) => {
        zoomEvents.push(`adjust:${delta}`);
      }),
      resetZoom: vi.fn(() => {
        zoomEvents.push('reset');
      }),
    };

    module.registerWebviewHandlers(handlers as any);

    expect(handlers.setTrustState).toHaveBeenCalledTimes(1);
    expect(handlers.setSafeContent).toHaveBeenCalledWith('<p>safe</p>');
    expect(handlers.setRuntimeConfig).toHaveBeenCalledTimes(1);
    expect(handlers.setRuntimeConfig).toHaveBeenCalledWith({
      sourceLineHighlight: false,
      sourceLineHighlightColor: 'white',
      scrollSync: 'previewToEditor',
      shimSideRail: false,
    });
    expect(handlers.setTrustState.mock.invocationCallOrder[0]).toBeLessThan(
      handlers.setSafeContent.mock.invocationCallOrder[0]
    );
    expect(handlers.setSafeContent.mock.invocationCallOrder[0]).toBeLessThan(
      handlers.setRuntimeConfig.mock.invocationCallOrder[0]
    );
    expect(zoomEvents).toEqual([
      'adjust:0.1',
      'adjust:0.1',
      'reset',
      'adjust:-0.1',
    ]);

    handlers.setSafeContent.mockClear();
    handlers.setError.mockClear();
    const outcomeQueue = createRpcMessageQueue({
      log: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      getHandlers: () => handlers,
    });

    outcomeQueue.enqueueQueued({
      type: 'error',
      payload: { message: 'older error' },
    });
    outcomeQueue.enqueueQueued({
      type: 'safe',
      payload: { html: '<p>newer content</p>' },
    });
    outcomeQueue.flush();

    expect(handlers.setSafeContent).toHaveBeenCalledWith(
      '<p>newer content</p>'
    );
    expect(handlers.setError).not.toHaveBeenCalled();

    handlers.setSafeContent.mockClear();
    outcomeQueue.enqueueQueued({
      type: 'safe',
      payload: { html: '<p>older content</p>' },
    });
    outcomeQueue.enqueueQueued({
      type: 'error',
      payload: { message: 'newer error' },
    });
    outcomeQueue.flush();

    expect(handlers.setSafeContent).not.toHaveBeenCalled();
    expect(handlers.setError).toHaveBeenCalledWith({
      message: 'newer error',
    });
  });

  it('gates trusted content for queued and direct handler paths', async () => {
    let scenario = await setupRpcScenario();
    let handlers = createStateHandlers();

    scenario.exposedHandle.updatePreview(
      'export default function Demo() {}',
      '/doc.mdx',
      []
    );
    scenario.module.registerWebviewHandlers(handlers as any);
    expect(handlers.setTrustedContent).not.toHaveBeenCalled();

    scenario = await setupRpcScenario();
    handlers = createStateHandlers();
    scenario.exposedHandle.setTrustState(createTrustState(false));
    scenario.exposedHandle.updatePreview(
      'export default function Demo() {}',
      '/doc.mdx',
      []
    );
    scenario.module.registerWebviewHandlers(handlers as any);
    expect(handlers.setTrustedContent).not.toHaveBeenCalled();

    scenario = await setupRpcScenario();
    handlers = createStateHandlers();
    scenario.module.registerWebviewHandlers(handlers as any);
    scenario.exposedHandle.setTrustState(createTrustState(false));
    scenario.exposedHandle.updatePreview(
      'export default function Demo() {}',
      '/doc.mdx',
      []
    );
    expect(handlers.setTrustedContent).not.toHaveBeenCalled();

    scenario = await setupRpcScenario();
    handlers = createStateHandlers();
    scenario.module.registerWebviewHandlers(handlers as any);
    scenario.exposedHandle.setTrustState(createTrustState(true));
    scenario.exposedHandle.updatePreview(
      'export default function Demo() {}',
      '/doc.mdx',
      ['/dep.ts']
    );
    expect(handlers.setTrustedContent).toHaveBeenCalledWith(
      'export default function Demo() {}',
      '/doc.mdx',
      ['/dep.ts']
    );

    scenario = await setupRpcScenario();
    handlers = createStateHandlers();
    scenario.module.registerWebviewHandlers(handlers as any);
    scenario.exposedHandle.updatePreview(
      'export default function Demo() {}',
      '/doc.mdx',
      ['/dep.ts']
    );

    expect(handlers.setTrustedContent).not.toHaveBeenCalled();

    scenario.exposedHandle.setTrustState(createTrustState(true));

    expect(handlers.setTrustState).toHaveBeenCalledWith(createTrustState(true));
    expect(handlers.setTrustedContent).toHaveBeenCalledWith(
      'export default function Demo() {}',
      '/doc.mdx',
      ['/dep.ts']
    );

    scenario = await setupRpcScenario();
    handlers = createStateHandlers();
    scenario.exposedHandle.updatePreview(
      'export default function Demo() {}',
      '/doc.mdx',
      ['/dep.ts']
    );
    scenario.module.registerWebviewHandlers(handlers as any);

    expect(handlers.setTrustedContent).not.toHaveBeenCalled();

    scenario.exposedHandle.setTrustState(createTrustState(true));

    expect(handlers.setTrustedContent).toHaveBeenCalledWith(
      'export default function Demo() {}',
      '/doc.mdx',
      ['/dep.ts']
    );
  });
});

interface ExposedHandle {
  setTrustState: (state: unknown) => void;
  updatePreview: (
    code: string,
    entryFilePath: string,
    dependencies: string[]
  ) => void;
}

async function setupRpcScenario(): Promise<{
  module: typeof import('../../packages/webview-client/src/platform/rpc/webview-rpc-client');
  exposedHandle: ExposedHandle;
}> {
  vi.clearAllMocks();
  vi.resetModules();
  (globalThis as any).acquireVsCodeApi = acquireMock;

  const module =
    await import('../../packages/webview-client/src/platform/rpc/webview-rpc-client');

  module.initRPCWebviewSide();

  return {
    module,
    exposedHandle: mockExpose.mock.calls[0][0] as ExposedHandle,
  };
}

function createTrustState(canExecute: boolean) {
  return {
    workspaceTrusted: canExecute,
    scriptsEnabled: canExecute,
    canExecute,
    openMdxLinksInPreview: false,
  };
}

function createStateHandlers() {
  return {
    setTrustState: vi.fn(),
    setSafeContent: vi.fn(),
    setTrustedContent: vi.fn(),
    setError: vi.fn(),
    setStale: vi.fn(),
    setRuntimeConfig: vi.fn(),
  };
}
