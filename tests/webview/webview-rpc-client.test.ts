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
  });

  it('registerWebviewHandlers flushes buffered queued and optional messages', async () => {
    const module =
      await import('../../packages/webview-client/src/platform/rpc/webview-rpc-client');

    module.initRPCWebviewSide();

    const exposedHandle = mockExpose.mock.calls[0][0] as {
      setTrustState: (state: unknown) => void;
      updatePreviewSafe: (html: string) => void;
      setSourceLineHighlight: (enabled: boolean) => void;
    };

    exposedHandle.setTrustState({
      workspaceTrusted: true,
      scriptsEnabled: true,
      canExecute: true,
      openMdxLinksInPreview: false,
    });
    exposedHandle.updatePreviewSafe('<p>safe</p>');
    exposedHandle.setSourceLineHighlight(false);

    const handlers = {
      setTrustState: vi.fn(),
      setSafeContent: vi.fn(),
      setTrustedContent: vi.fn(),
      setError: vi.fn(),
      setStale: vi.fn(),
      setSourceLineHighlight: vi.fn(),
    };

    module.registerWebviewHandlers(handlers as any);

    expect(handlers.setTrustState).toHaveBeenCalledTimes(1);
    expect(handlers.setSafeContent).toHaveBeenCalledWith('<p>safe</p>');
    expect(handlers.setSourceLineHighlight).toHaveBeenCalledWith(false);
  });
});
