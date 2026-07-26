// tests/extension/preview/PreviewWebviewBridge.test.ts
// verify representative webview bridge forwarding contracts

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockThemeManager } from '../../helpers/mock-services';

import { PreviewWebviewBridge } from '../../../packages/extension-host/src/features/preview/PreviewWebviewBridge';

function createMockHandle() {
  return {
    setTrustState: vi.fn(),
    setFramework: vi.fn(),
    setTailwindCss: vi.fn(),
    setTailwindBrowserCss: vi.fn(),
    setTheme: vi.fn(),
    setRuntimeConfig: vi.fn(),
    adjustZoom: vi.fn(),
    resetZoom: vi.fn(),
    scrollToLine: vi.fn(),
    invalidate: vi.fn(async () => {}),
    clearAllCaches: vi.fn(async () => {}),
  };
}

function createWatcherManager() {
  const mockDocTracker = { setNotifier: vi.fn() };
  const mockCssWatcher = { setNotifier: vi.fn() };

  return {
    get: vi.fn((name: string) => {
      if (name === 'document') {
        return mockDocTracker;
      }
      if (name === 'customCss') {
        return mockCssWatcher;
      }
      return undefined;
    }),
    mockDocTracker,
    mockCssWatcher,
  };
}

const mockDocUri = { scheme: 'file', fsPath: '/workspace/test.mdx' };

describe('PreviewWebviewBridge', () => {
  let bridge: PreviewWebviewBridge;

  beforeEach(() => {
    vi.clearAllMocks();
    bridge = new PreviewWebviewBridge();
    mockThemeManager.getWebviewThemeState.mockReturnValue({
      previewTheme: 'github-light',
      codeBlockTheme: 'auto',
    });
    mockThemeManager.extractThemeFromFrontmatter.mockReturnValue({});
  });

  it('returns undefined webview URIs before a handle is attached', () => {
    expect(bridge.getWebviewUri('/workspace/file.css')).toBeUndefined();
  });

  it('connects watcher notifiers when a handle is attached', () => {
    const handle = createMockHandle();
    const watcherManager = createWatcherManager();

    bridge.setWebviewHandle(handle as never, watcherManager as never);

    expect(watcherManager.mockDocTracker.setNotifier).toHaveBeenCalledWith(
      handle
    );
    expect(watcherManager.mockCssWatcher.setNotifier).toHaveBeenCalledWith(
      handle
    );
  });

  it('pushes theme state after the webview handshake completes', async () => {
    const handle = createMockHandle();
    const watcherManager = createWatcherManager();
    bridge.setWebviewHandle(handle as never, watcherManager as never);

    bridge.onWebviewReady(mockDocUri as never);
    // icon-pack resolution is async; let the deferred setTheme settle
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(handle.setTheme).toHaveBeenCalledWith({
      previewTheme: 'github-light',
      codeBlockTheme: 'auto',
      mermaidIconPacks: [],
    });
  });

  it('forwards runtime flags and scroll requests to the webview handle', () => {
    const handle = createMockHandle();
    const watcherManager = createWatcherManager();
    bridge.setWebviewHandle(handle as never, watcherManager as never);

    bridge.pushRuntimeConfiguration({
      sourceLineHighlight: false,
      sourceLineHighlightColor: 'white',
      scrollSync: 'bidirectional',
      shimSideRail: false,
    });

    expect(handle.setRuntimeConfig).toHaveBeenCalledWith({
      sourceLineHighlight: false,
      sourceLineHighlightColor: 'white',
      scrollSync: 'bidirectional',
      shimSideRail: false,
    });

    bridge.scrollToLine(42);
    expect(handle.scrollToLine).toHaveBeenCalledWith(42);
  });

  it('sends unchanged state once per handshake', async () => {
    const handle = createMockHandle();
    const watcherManager = createWatcherManager();
    bridge.setWebviewHandle(handle as never, watcherManager as never);
    const deltaHandle = bridge.getHandle()!;
    const trustState = {
      workspaceTrusted: true,
      scriptsEnabled: true,
      canExecute: true,
      openMdxLinksInPreview: true,
    };
    const runtimeConfig = {
      sourceLineHighlight: false,
      sourceLineHighlightColor: 'white' as const,
      scrollSync: 'bidirectional' as const,
      shimSideRail: false,
    };

    deltaHandle.setTrustState(trustState);
    deltaHandle.setTrustState(trustState);
    deltaHandle.setTailwindBrowserCss('');
    deltaHandle.setTailwindBrowserCss('');
    deltaHandle.setTailwindCss('');
    deltaHandle.setTailwindCss('');
    bridge.pushRuntimeConfiguration(runtimeConfig);
    bridge.pushRuntimeConfiguration({ ...runtimeConfig });

    expect(handle.setTrustState).toHaveBeenCalledTimes(1);
    expect(handle.setTailwindBrowserCss).toHaveBeenCalledTimes(1);
    expect(handle.setTailwindCss).toHaveBeenCalledTimes(1);
    expect(handle.setRuntimeConfig).toHaveBeenCalledTimes(1);

    bridge.onWebviewReady(mockDocUri as never);
    deltaHandle.setTrustState(trustState);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(handle.setTrustState).toHaveBeenCalledTimes(2);
  });

  it('pushes the base theme when a frontmatter override is removed', async () => {
    const handle = createMockHandle();
    const watcherManager = createWatcherManager();
    bridge.setWebviewHandle(handle as never, watcherManager as never);
    mockThemeManager.extractThemeFromFrontmatter
      .mockReturnValueOnce({ previewTheme: 'github-dark' })
      .mockReturnValue({});

    bridge.pushThemeState(mockDocUri as never, {
      previewTheme: 'github-dark',
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    bridge.pushThemeState(mockDocUri as never, {});
    await new Promise((resolve) => setTimeout(resolve, 0));
    bridge.pushThemeState(mockDocUri as never, {});
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(handle.setTheme).toHaveBeenCalledTimes(2);
    expect(handle.setTheme).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ previewTheme: 'github-dark' })
    );
    expect(handle.setTheme).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ previewTheme: 'github-light' })
    );
  });
});
