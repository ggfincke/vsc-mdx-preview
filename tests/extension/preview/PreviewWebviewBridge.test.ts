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
    setCustomCss: vi.fn(),
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
    mockThemeManager.getWebviewThemeState.mockImplementation(
      (_docUri, overrides = {}) => ({
        previewTheme: overrides.previewTheme ?? 'github-light',
        codeBlockTheme: overrides.codeBlockTheme ?? 'auto',
      })
    );
    mockThemeManager.extractThemeFromFrontmatter.mockImplementation(
      (frontmatter) => ({
        ...(typeof frontmatter.previewTheme === 'string'
          ? { previewTheme: frontmatter.previewTheme }
          : {}),
        ...(typeof frontmatter.codeBlockTheme === 'string'
          ? { codeBlockTheme: frontmatter.codeBlockTheme }
          : {}),
      })
    );
  });

  it('connects watcher notifiers when a handle is attached', () => {
    const handle = createMockHandle();
    const watcherManager = createWatcherManager();

    bridge.setWebviewHandle(handle as never, watcherManager as never);

    expect(watcherManager.mockDocTracker.setNotifier).toHaveBeenCalledWith(
      handle
    );
    expect(watcherManager.mockCssWatcher.setNotifier).toHaveBeenCalledWith(
      bridge
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

  it('sends snapshots & unchanged state once per handshake', async () => {
    const handle = createMockHandle();
    const watcherManager = createWatcherManager();
    bridge.setCustomCss('.initial { color: red; }');
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

    expect(handle.setCustomCss).not.toHaveBeenCalled();
    expect(handle.setTrustState).toHaveBeenCalledTimes(1);
    expect(handle.setTailwindBrowserCss).toHaveBeenCalledTimes(1);
    expect(handle.setTailwindCss).toHaveBeenCalledTimes(1);
    expect(handle.setRuntimeConfig).toHaveBeenCalledTimes(1);

    bridge.onWebviewReady(mockDocUri as never);
    deltaHandle.setTrustState(trustState);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(handle.setCustomCss).toHaveBeenCalledTimes(1);
    expect(handle.setCustomCss).toHaveBeenLastCalledWith(
      '.initial { color: red; }'
    );
    expect(handle.setTrustState).toHaveBeenCalledTimes(2);

    bridge.beginHandshake();
    bridge.setCustomCss('.intermediate { color: blue; }');
    bridge.setCustomCss('.latest { color: green; }');
    expect(handle.setCustomCss).toHaveBeenCalledTimes(1);

    bridge.onWebviewReady(mockDocUri as never);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(handle.setCustomCss).toHaveBeenCalledTimes(2);
    expect(handle.setCustomCss).toHaveBeenLastCalledWith(
      '.latest { color: green; }'
    );
  });

  it('retains, replays, replaces & clears frontmatter theme inputs', async () => {
    const handle = createMockHandle();
    const watcherManager = createWatcherManager();
    bridge.setWebviewHandle(handle as never, watcherManager as never);

    bridge.applyFrontmatterTheme(mockDocUri as never, {
      previewTheme: 'github-dark',
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    bridge.pushThemeState(mockDocUri as never);
    await new Promise((resolve) => setTimeout(resolve, 0));

    bridge.beginHandshake();
    bridge.onWebviewReady(mockDocUri as never);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(handle.setTheme).toHaveBeenCalledTimes(2);
    expect(handle.setTheme).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ previewTheme: 'github-dark' })
    );
    expect(handle.setTheme).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ previewTheme: 'github-dark' })
    );

    bridge.applyFrontmatterTheme(mockDocUri as never, undefined);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(handle.setTheme).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ previewTheme: 'github-light' })
    );

    bridge.applyFrontmatterTheme(mockDocUri as never, {
      previewTheme: 'github-dark',
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    bridge.beginHandshake();
    bridge.clearFrontmatterTheme();
    bridge.onWebviewReady(mockDocUri as never);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(handle.setTheme).toHaveBeenLastCalledWith(
      expect.objectContaining({ previewTheme: 'github-light' })
    );
  });
});
