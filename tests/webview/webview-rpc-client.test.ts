// tests/webview/webview-rpc-client.test.ts
// integration-style tests for webview-rpc-client composition root
//
// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockWrap,
  mockExpose,
  mockExtensionHandle,
  acquireMock,
  mockPostMessage,
  mockGetState,
  mockSetState,
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
    reportPreviewSourceLine: vi.fn(async () => {}),
    renderPlantUml: vi.fn(async () => undefined),
  };
  const mockWrap = vi.fn(() => mockExtensionHandle);
  const mockExpose = vi.fn();
  const acquireMock = vi.fn(() => ({
    postMessage: mockPostMessage,
    getState: mockGetState,
    setState: mockSetState,
  }));

  return {
    mockWrap,
    mockExpose,
    mockExtensionHandle,
    acquireMock,
    mockPostMessage,
    mockGetState,
    mockSetState,
  };
});

vi.mock('comlink', () => ({
  wrap: (...args: unknown[]) => mockWrap(...args),
  expose: (...args: unknown[]) => mockExpose(...args),
}));

describe('webview-rpc-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    (globalThis as any).acquireVsCodeApi = acquireMock;
  });

  afterEach(() => {
    delete (globalThis as any).acquireVsCodeApi;
  });

  it('imports without requiring global acquireVsCodeApi at module load time', async () => {
    delete (globalThis as any).acquireVsCodeApi;

    await expect(
      import('../../packages/webview-client/src/platform/rpc/webview-rpc-client')
    ).resolves.toBeTruthy();
  });

  it('initRPCWebviewSide bootstraps extension handle and handshake path', async () => {
    const module =
      await import('../../packages/webview-client/src/platform/rpc/webview-rpc-client');

    module.initRPCWebviewSide();

    expect(acquireMock).toHaveBeenCalledTimes(1);
    expect(mockWrap).toHaveBeenCalledTimes(1);
    expect(mockExpose).toHaveBeenCalledTimes(1);
    expect(mockExtensionHandle.handshake).toHaveBeenCalledTimes(1);

    module.ExtensionHandle.openExternal('https://example.com');
    expect(mockExtensionHandle.openExternal).toHaveBeenCalledWith(
      'https://example.com'
    );

    await module.ExtensionHandle.reportPreviewSourceLine(12);
    expect(mockExtensionHandle.reportPreviewSourceLine).toHaveBeenCalledWith(
      12
    );
  });

  it('registerWebviewHandlers flushes buffered queued and optional messages', async () => {
    const module =
      await import('../../packages/webview-client/src/platform/rpc/webview-rpc-client');

    module.initRPCWebviewSide();

    const exposedHandle = mockExpose.mock.calls[0][0] as {
      setTrustState: (state: unknown) => void;
      updatePreviewSafe: (html: string) => void;
      setSourceLineHighlight: (enabled: boolean) => void;
      setScrollSync: (mode: string) => void;
    };

    exposedHandle.setTrustState({
      workspaceTrusted: true,
      scriptsEnabled: true,
      canExecute: true,
      openMdxLinksInPreview: false,
    });
    exposedHandle.updatePreviewSafe('<p>safe</p>');
    exposedHandle.setSourceLineHighlight(false);
    exposedHandle.setScrollSync('previewToEditor');

    const handlers = {
      setTrustState: vi.fn(),
      setSafeContent: vi.fn(),
      setTrustedContent: vi.fn(),
      setError: vi.fn(),
      setStale: vi.fn(),
      setSourceLineHighlight: vi.fn(),
      setScrollSync: vi.fn(),
    };

    module.registerWebviewHandlers(handlers as any);

    expect(handlers.setTrustState).toHaveBeenCalledTimes(1);
    expect(handlers.setSafeContent).toHaveBeenCalledWith('<p>safe</p>');
    expect(handlers.setSourceLineHighlight).toHaveBeenCalledWith(false);
    expect(handlers.setScrollSync).toHaveBeenCalledWith('previewToEditor');
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
    setSourceLineHighlight: vi.fn(),
  };
}
