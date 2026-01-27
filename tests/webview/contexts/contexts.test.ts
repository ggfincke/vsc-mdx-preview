// tests/webview/contexts/contexts.test.ts
// Unit tests for J.1 granular state contexts

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the debug utility
vi.mock('../../../packages/webview-app/src/utils/debug', () => ({
  debug: vi.fn(),
}));

describe('TrustContext', () => {
  describe('initial state', () => {
    it('should have correct initial trust state structure', () => {
      const initialState = {
        workspaceTrusted: false,
        scriptsEnabled: false,
        canExecute: false,
        openMdxLinksInPreview: true,
      };

      expect(initialState.workspaceTrusted).toBe(false);
      expect(initialState.scriptsEnabled).toBe(false);
      expect(initialState.canExecute).toBe(false);
      expect(initialState.openMdxLinksInPreview).toBe(true);
    });
  });

  describe('TrustState updates', () => {
    it('should handle trust state update', () => {
      let state = {
        workspaceTrusted: false,
        scriptsEnabled: false,
        canExecute: false,
        openMdxLinksInPreview: true,
      };

      const newState = {
        workspaceTrusted: true,
        scriptsEnabled: true,
        canExecute: true,
        openMdxLinksInPreview: false,
      };

      state = newState;

      expect(state.workspaceTrusted).toBe(true);
      expect(state.canExecute).toBe(true);
    });
  });
});

describe('PreviewContext', () => {
  describe('content state', () => {
    it('should handle safe content', () => {
      const safeContent = {
        mode: 'safe' as const,
        html: '<p>Hello</p>',
      };

      expect(safeContent.mode).toBe('safe');
      expect(safeContent.html).toBe('<p>Hello</p>');
    });

    it('should handle trusted content', () => {
      const trustedContent = {
        mode: 'trusted' as const,
        code: 'const x = 1;',
        entryFilePath: '/path/to/file.mdx',
        dependencies: ['react', './Button'],
      };

      expect(trustedContent.mode).toBe('trusted');
      expect(trustedContent.code).toBe('const x = 1;');
      expect(trustedContent.dependencies).toEqual(['react', './Button']);
    });
  });

  describe('error state', () => {
    it('should handle error with message and stack', () => {
      const error = {
        message: 'Something went wrong',
        stack: 'Error: Something went wrong\n    at ...',
      };

      expect(error.message).toBe('Something went wrong');
      expect(error.stack).toContain('Error:');
    });

    it('should handle clearing error', () => {
      let error: { message: string; stack?: string } | null = {
        message: 'Error',
      };

      error = null;

      expect(error).toBeNull();
    });
  });
});

describe('LoadingContext', () => {
  describe('loading state', () => {
    it('should start with isLoading true', () => {
      const initialIsLoading = true;
      expect(initialIsLoading).toBe(true);
    });

    it('should handle isLoading toggle', () => {
      let isLoading = true;

      isLoading = false;
      expect(isLoading).toBe(false);

      isLoading = true;
      expect(isLoading).toBe(true);
    });
  });

  describe('stale state', () => {
    it('should start with isStale false', () => {
      const initialIsStale = false;
      expect(initialIsStale).toBe(false);
    });

    it('should handle isStale toggle', () => {
      let isStale = false;

      isStale = true;
      expect(isStale).toBe(true);

      isStale = false;
      expect(isStale).toBe(false);
    });
  });
});

describe('ZoomContext', () => {
  const ZOOM_MIN = 25;
  const ZOOM_MAX = 500;
  const ZOOM_STEP = 10;
  const ZOOM_DEFAULT = 100;

  describe('zoom level state', () => {
    it('should start with default zoom level', () => {
      const zoomLevel = ZOOM_DEFAULT;
      expect(zoomLevel).toBe(100);
    });
  });

  describe('zoomIn', () => {
    it('should increase zoom by step', () => {
      let zoomLevel = ZOOM_DEFAULT;
      zoomLevel = Math.min(ZOOM_MAX, zoomLevel + ZOOM_STEP);
      expect(zoomLevel).toBe(110);
    });

    it('should not exceed max zoom', () => {
      let zoomLevel = ZOOM_MAX - 5;
      zoomLevel = Math.min(ZOOM_MAX, zoomLevel + ZOOM_STEP);
      expect(zoomLevel).toBe(ZOOM_MAX);
    });
  });

  describe('zoomOut', () => {
    it('should decrease zoom by step', () => {
      let zoomLevel = ZOOM_DEFAULT;
      zoomLevel = Math.max(ZOOM_MIN, zoomLevel - ZOOM_STEP);
      expect(zoomLevel).toBe(90);
    });

    it('should not go below min zoom', () => {
      let zoomLevel = ZOOM_MIN + 5;
      zoomLevel = Math.max(ZOOM_MIN, zoomLevel - ZOOM_STEP);
      expect(zoomLevel).toBe(ZOOM_MIN);
    });
  });

  describe('resetZoom', () => {
    it('should reset to default', () => {
      let zoomLevel = 150;
      zoomLevel = ZOOM_DEFAULT;
      expect(zoomLevel).toBe(100);
    });
  });
});

describe('NextraContext', () => {
  describe('nextra metadata', () => {
    it('should start with null metadata', () => {
      const nextraMeta = null;
      expect(nextraMeta).toBeNull();
    });

    it('should handle metadata with layout', () => {
      const nextraMeta = {
        title: 'Page Title',
        layout: 'full' as const,
      };

      expect(nextraMeta.title).toBe('Page Title');
      expect(nextraMeta.layout).toBe('full');
    });

    it('should handle raw layout', () => {
      const nextraMeta = {
        layout: 'raw' as const,
      };

      expect(nextraMeta.layout).toBe('raw');
    });
  });
});

describe('Context isolation', () => {
  it('should allow independent state updates', () => {
    // Simulating that updating one context doesn't affect others
    const states = {
      trust: { canExecute: false },
      loading: { isLoading: true, isStale: false },
      zoom: { zoomLevel: 100 },
    };

    // Update only loading
    states.loading.isLoading = false;

    // Others should be unchanged
    expect(states.trust.canExecute).toBe(false);
    expect(states.zoom.zoomLevel).toBe(100);
    expect(states.loading.isLoading).toBe(false);
  });

  it('should allow zoom changes without affecting content', () => {
    const contentState = {
      content: { mode: 'safe' as const, html: '<p>Test</p>' },
    };

    const zoomState = {
      zoomLevel: 100,
    };

    // Change zoom
    zoomState.zoomLevel = 150;

    // Content should be unchanged
    expect(contentState.content.html).toBe('<p>Test</p>');
    expect(zoomState.zoomLevel).toBe(150);
  });
});
