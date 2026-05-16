// tests/extension/preview/PreviewWebviewBridge.test.ts
// verify representative webview bridge forwarding contracts

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockThemeManager } from '../../helpers/mock-services';

vi.mock(
  '../../../packages/extension-host/src/features/preview/watchers',
  () => ({
    DocumentTracker: class {},
    CustomCssWatcher: class {},
    WatcherManager: class {},
  })
);

import { PreviewWebviewBridge } from '../../../packages/extension-host/src/features/preview/PreviewWebviewBridge';

function createMockHandle() {
  return {
    setTheme: vi.fn(),
    setSourceLineHighlight: vi.fn(),
    setSourceLineHighlightColor: vi.fn(),
    setScrollSync: vi.fn(),
    setShimSideRail: vi.fn(),
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

  it('pushes theme state after the webview handshake completes', () => {
    const handle = createMockHandle();
    const watcherManager = createWatcherManager();
    bridge.setWebviewHandle(handle as never, watcherManager as never);

    bridge.onWebviewReady(mockDocUri as never);

    expect(handle.setTheme).toHaveBeenCalledWith({
      previewTheme: 'github-light',
      codeBlockTheme: 'auto',
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

    expect(handle.setSourceLineHighlight).toHaveBeenCalledWith(false);
    expect(handle.setSourceLineHighlightColor).toHaveBeenCalledWith('white');
    expect(handle.setScrollSync).toHaveBeenCalledWith('bidirectional');
    expect(handle.setShimSideRail).toHaveBeenCalledWith(false);

    bridge.scrollToLine(42);
    expect(handle.scrollToLine).toHaveBeenCalledWith(42);
  });
});
