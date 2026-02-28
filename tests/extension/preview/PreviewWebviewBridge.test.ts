// tests/extension/preview/PreviewWebviewBridge.test.ts
// webview communication — theme merging & RPC forwarding

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockThemeManager } from '../../helpers/mock-services';

// mock watchers
vi.mock(
  '../../../packages/extension-host/src/features/preview/watchers',
  () => ({
    DocumentTracker: class {},
    CustomCssWatcher: class {},
    WatcherManager: class {},
  })
);

import { PreviewWebviewBridge } from '../../../packages/extension-host/src/features/preview/PreviewWebviewBridge';

// mock webview handle
function createMockHandle() {
  return {
    setTheme: vi.fn(),
    setShowToc: vi.fn(),
    setSourceLineHighlight: vi.fn(),
    setSourceLineHighlightColor: vi.fn(),
    setShimSideRail: vi.fn(),
    setFrontmatter: vi.fn(),
    invalidate: vi.fn(async () => {}),
    clearAllCaches: vi.fn(async () => {}),
  };
}

// mock WatcherManager
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

  describe('getWebviewUri()', () => {
    it('returns undefined when no webview set', () => {
      expect(bridge.getWebviewUri('/workspace/file.css')).toBeUndefined();
    });
  });

  describe('getHandle()', () => {
    it('returns undefined before handle is set', () => {
      expect(bridge.getHandle()).toBeUndefined();
    });
  });

  describe('setWebviewHandle()', () => {
    it('connects watchers to handle', () => {
      const handle = createMockHandle();
      const wm = createWatcherManager();

      bridge.setWebviewHandle(handle as any, wm as any);

      expect(wm.mockDocTracker.setNotifier).toHaveBeenCalledWith(handle);
      expect(wm.mockCssWatcher.setNotifier).toHaveBeenCalledWith(handle);
    });

    it('stores handle for later retrieval', () => {
      const handle = createMockHandle();
      const wm = createWatcherManager();

      bridge.setWebviewHandle(handle as any, wm as any);

      expect(bridge.getHandle()).toBe(handle);
    });
  });

  describe('onWebviewReady()', () => {
    it('pushes theme state to webview on handshake completion', () => {
      const handle = createMockHandle();
      const wm = createWatcherManager();
      bridge.setWebviewHandle(handle as any, wm as any);

      bridge.onWebviewReady(mockDocUri as any);

      expect(mockThemeManager.getWebviewThemeState).toHaveBeenCalled();
      expect(handle.setTheme).toHaveBeenCalledWith({
        previewTheme: 'github-light',
        codeBlockTheme: 'auto',
      });
    });
  });

  describe('pushThemeState()', () => {
    it('returns early when no webview handle', () => {
      bridge.pushThemeState(mockDocUri as any);

      expect(mockThemeManager.getWebviewThemeState).not.toHaveBeenCalled();
    });

    it('sends base theme when no frontmatter', () => {
      const handle = createMockHandle();
      const wm = createWatcherManager();
      bridge.setWebviewHandle(handle as any, wm as any);

      bridge.pushThemeState(mockDocUri as any);

      expect(handle.setTheme).toHaveBeenCalledWith({
        previewTheme: 'github-light',
        codeBlockTheme: 'auto',
      });
    });

    it('merges frontmatter theme overrides', () => {
      const handle = createMockHandle();
      const wm = createWatcherManager();
      bridge.setWebviewHandle(handle as any, wm as any);

      mockThemeManager.extractThemeFromFrontmatter.mockReturnValue({
        previewTheme: 'atom-dark',
      });

      bridge.pushThemeState(mockDocUri as any, { theme: 'atom-dark' });

      expect(handle.setTheme).toHaveBeenCalledWith({
        previewTheme: 'atom-dark',
        codeBlockTheme: 'auto',
      });
    });

    it('merges only codeBlockTheme when previewTheme absent', () => {
      const handle = createMockHandle();
      const wm = createWatcherManager();
      bridge.setWebviewHandle(handle as any, wm as any);

      mockThemeManager.extractThemeFromFrontmatter.mockReturnValue({
        codeBlockTheme: 'monokai',
      });

      bridge.pushThemeState(mockDocUri as any, { codeTheme: 'monokai' });

      expect(handle.setTheme).toHaveBeenCalledWith({
        previewTheme: 'github-light',
        codeBlockTheme: 'monokai',
      });
    });
  });

  describe('invalidate()', () => {
    it('delegates to webview handle', async () => {
      const handle = createMockHandle();
      const wm = createWatcherManager();
      bridge.setWebviewHandle(handle as any, wm as any);

      await bridge.invalidate('/workspace/file.ts');

      expect(handle.invalidate).toHaveBeenCalledWith('/workspace/file.ts');
    });

    it('does nothing when no handle', async () => {
      // should not throw
      await bridge.invalidate('/workspace/file.ts');
    });
  });

  describe('clearAllCaches()', () => {
    it('delegates to webview handle', async () => {
      const handle = createMockHandle();
      const wm = createWatcherManager();
      bridge.setWebviewHandle(handle as any, wm as any);

      await bridge.clearAllCaches();

      expect(handle.clearAllCaches).toHaveBeenCalled();
    });
  });

  describe('pushRuntimeConfiguration()', () => {
    it('returns early when no handle is set', () => {
      bridge.pushRuntimeConfiguration(
        {
          showFrontmatter: true,
          showToc: true,
          sourceLineHighlight: true,
          sourceLineHighlightColor: 'dependent',
          shimSideRail: true,
        },
        { title: 'Doc' }
      );

      expect(mockThemeManager.getWebviewThemeState).not.toHaveBeenCalled();
    });

    it('pushes runtime flags & frontmatter when enabled', () => {
      const handle = createMockHandle();
      const wm = createWatcherManager();
      bridge.setWebviewHandle(handle as any, wm as any);

      bridge.pushRuntimeConfiguration(
        {
          showFrontmatter: true,
          showToc: true,
          sourceLineHighlight: false,
          sourceLineHighlightColor: 'white',
          shimSideRail: false,
        },
        { title: 'Runtime Title' }
      );

      expect(handle.setShowToc).toHaveBeenCalledWith(true);
      expect(handle.setSourceLineHighlight).toHaveBeenCalledWith(false);
      expect(handle.setSourceLineHighlightColor).toHaveBeenCalledWith('white');
      expect(handle.setShimSideRail).toHaveBeenCalledWith(false);
      expect(handle.setFrontmatter).toHaveBeenCalledWith({
        title: 'Runtime Title',
      });
    });

    it('clears frontmatter when panel is disabled', () => {
      const handle = createMockHandle();
      const wm = createWatcherManager();
      bridge.setWebviewHandle(handle as any, wm as any);

      bridge.pushRuntimeConfiguration(
        {
          showFrontmatter: false,
          showToc: true,
          sourceLineHighlight: true,
          sourceLineHighlightColor: 'dependent',
          shimSideRail: true,
        },
        { title: 'Runtime Title' }
      );

      expect(handle.setFrontmatter).toHaveBeenCalledWith({});
    });
  });
});
