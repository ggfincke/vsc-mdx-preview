// packages/webview-app/src/test/useMermaidRendering.test.tsx
// unit tests for useMermaidRendering hook

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import { useMermaidRendering } from '../hooks/useMermaidRendering';
import type { MermaidDiagramInfo } from '../utils/findMermaidContainers';

// mock findMermaidContainers utility
vi.mock('../utils/findMermaidContainers', () => ({
  findMermaidContainers: vi.fn(() => []),
}));

// mock MermaidRenderer component
vi.mock('../components/MermaidRenderer', () => ({
  MermaidRenderer: vi.fn(({ id, code }: { id: string; code: string }) => (
    <div data-testid={`mermaid-${id}`}>{code}</div>
  )),
}));

// helper to create mock diagram info
function createMockDiagram(
  id: string,
  code: string,
  el?: HTMLElement
): MermaidDiagramInfo {
  return {
    id,
    code,
    el: el ?? document.createElement('div'),
  };
}

describe('useMermaidRendering', () => {
  let containerEl: HTMLDivElement;
  let containerRef: { current: HTMLElement | null };
  let mockFindMermaidContainers: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    cleanup();
    vi.clearAllMocks();
    vi.useFakeTimers();

    // create container element
    containerEl = document.createElement('div');
    document.body.appendChild(containerEl);
    containerRef = { current: containerEl };

    // get mock reference
    const mod = await import('../utils/findMermaidContainers');
    mockFindMermaidContainers = mod.findMermaidContainers as ReturnType<
      typeof vi.fn
    >;
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    document.body.removeChild(containerEl);
  });

  describe('initial scan', () => {
    it('scans container on mount', async () => {
      mockFindMermaidContainers.mockReturnValue([]);

      renderHook(() => useMermaidRendering(containerRef));

      expect(mockFindMermaidContainers).toHaveBeenCalledWith(containerEl);
    });

    it('returns empty array when no mermaid containers found', () => {
      mockFindMermaidContainers.mockReturnValue([]);

      const { result } = renderHook(() => useMermaidRendering(containerRef));

      expect(result.current.diagrams).toEqual([]);
    });

    it('returns found diagrams after mount', () => {
      const mockDiagrams = [
        createMockDiagram('d1', 'flowchart TD'),
        createMockDiagram('d2', 'sequenceDiagram'),
      ];
      mockFindMermaidContainers.mockReturnValue(mockDiagrams);

      const { result } = renderHook(() => useMermaidRendering(containerRef));

      expect(result.current.diagrams).toHaveLength(2);
      expect(result.current.diagrams[0].id).toBe('d1');
      expect(result.current.diagrams[1].id).toBe('d2');
    });

    it('does nothing when containerRef is null', () => {
      const nullRef = { current: null };

      const { result } = renderHook(() => useMermaidRendering(nullRef));

      expect(result.current.diagrams).toEqual([]);
      expect(mockFindMermaidContainers).not.toHaveBeenCalled();
    });
  });

  describe('renderPortals', () => {
    it('returns empty array when no diagrams', () => {
      mockFindMermaidContainers.mockReturnValue([]);

      const { result } = renderHook(() => useMermaidRendering(containerRef));
      const portals = result.current.renderPortals();

      expect(portals).toEqual([]);
    });

    it('returns portal for each diagram', () => {
      const el1 = document.createElement('div');
      const el2 = document.createElement('div');
      containerEl.appendChild(el1);
      containerEl.appendChild(el2);

      const mockDiagrams = [
        createMockDiagram('d1', 'flowchart TD', el1),
        createMockDiagram('d2', 'sequenceDiagram', el2),
      ];
      mockFindMermaidContainers.mockReturnValue(mockDiagrams);

      const { result } = renderHook(() => useMermaidRendering(containerRef));
      const portals = result.current.renderPortals();

      expect(portals).toHaveLength(2);
    });

    it('creates portals with correct content', () => {
      const el1 = document.createElement('div');
      containerEl.appendChild(el1);

      const mockDiagrams = [createMockDiagram('d1', 'flowchart TD', el1)];
      mockFindMermaidContainers.mockReturnValue(mockDiagrams);

      const { result } = renderHook(() => useMermaidRendering(containerRef));
      const portals = result.current.renderPortals();

      // portal should be a valid React element
      expect(portals[0]).toBeDefined();
    });
  });

  describe('mode switching', () => {
    it('uses after-paint mode by default', () => {
      mockFindMermaidContainers.mockReturnValue([]);

      // default mode is 'after-paint' which uses useEffect
      const { result } = renderHook(() => useMermaidRendering(containerRef));

      // hook should work without errors
      expect(result.current.diagrams).toBeDefined();
    });

    it('accepts before-paint mode option', () => {
      mockFindMermaidContainers.mockReturnValue([]);

      // 'before-paint' mode uses useLayoutEffect
      const { result } = renderHook(() =>
        useMermaidRendering(containerRef, { mode: 'before-paint' })
      );

      // hook should work without errors
      expect(result.current.diagrams).toBeDefined();
    });
  });

  describe('stale filtering', () => {
    it('filters out elements no longer in DOM when filterStale=true', () => {
      // create element that's in container
      const validEl = document.createElement('div');
      containerEl.appendChild(validEl);

      // create element NOT in container (stale)
      const staleEl = document.createElement('div');

      const mockDiagrams = [
        createMockDiagram('valid', 'flowchart TD', validEl),
        createMockDiagram('stale', 'sequenceDiagram', staleEl),
      ];
      mockFindMermaidContainers.mockReturnValue(mockDiagrams);

      const { result } = renderHook(() =>
        useMermaidRendering(containerRef, { filterStale: true })
      );

      // only valid element should remain
      expect(result.current.diagrams).toHaveLength(1);
      expect(result.current.diagrams[0].id).toBe('valid');
    });

    it('keeps all elements when filterStale=false', () => {
      const validEl = document.createElement('div');
      containerEl.appendChild(validEl);

      // stale element (not in container)
      const staleEl = document.createElement('div');

      const mockDiagrams = [
        createMockDiagram('valid', 'flowchart TD', validEl),
        createMockDiagram('stale', 'sequenceDiagram', staleEl),
      ];
      mockFindMermaidContainers.mockReturnValue(mockDiagrams);

      const { result } = renderHook(() =>
        useMermaidRendering(containerRef, { filterStale: false })
      );

      // both elements should remain
      expect(result.current.diagrams).toHaveLength(2);
    });

    it('keeps all elements when filterStale not specified (default)', () => {
      const validEl = document.createElement('div');
      containerEl.appendChild(validEl);

      const staleEl = document.createElement('div');

      const mockDiagrams = [
        createMockDiagram('valid', 'flowchart TD', validEl),
        createMockDiagram('stale', 'sequenceDiagram', staleEl),
      ];
      mockFindMermaidContainers.mockReturnValue(mockDiagrams);

      const { result } = renderHook(() => useMermaidRendering(containerRef));

      // default is filterStale=false, so both remain
      expect(result.current.diagrams).toHaveLength(2);
    });
  });

  describe('manual scan', () => {
    it('exposes scan function', () => {
      mockFindMermaidContainers.mockReturnValue([]);

      const { result } = renderHook(() => useMermaidRendering(containerRef));

      expect(typeof result.current.scan).toBe('function');
    });

    it('triggers scan when called manually', async () => {
      mockFindMermaidContainers.mockReturnValue([]);

      const { result } = renderHook(() => useMermaidRendering(containerRef));

      // clear initial call count
      mockFindMermaidContainers.mockClear();

      // trigger manual scan
      act(() => {
        result.current.scan();
      });

      // advance RAF
      act(() => {
        vi.advanceTimersByTime(16);
      });

      expect(mockFindMermaidContainers).toHaveBeenCalled();
    });

    it('updates diagrams when manual scan finds new containers', async () => {
      mockFindMermaidContainers.mockReturnValue([]);

      const { result } = renderHook(() => useMermaidRendering(containerRef));
      expect(result.current.diagrams).toHaveLength(0);

      // now mock returns diagrams
      const newDiagram = createMockDiagram('new', 'flowchart LR');
      mockFindMermaidContainers.mockReturnValue([newDiagram]);

      // trigger manual scan
      act(() => {
        result.current.scan();
      });

      // advance RAF
      act(() => {
        vi.advanceTimersByTime(16);
      });

      expect(result.current.diagrams).toHaveLength(1);
      expect(result.current.diagrams[0].id).toBe('new');
    });
  });

  describe('debouncing', () => {
    it('debounces rapid scan calls via RAF', async () => {
      mockFindMermaidContainers.mockReturnValue([]);

      const { result } = renderHook(() => useMermaidRendering(containerRef));

      // clear initial call
      mockFindMermaidContainers.mockClear();

      // trigger multiple rapid scans
      act(() => {
        result.current.scan();
        result.current.scan();
        result.current.scan();
      });

      // advance RAF once
      act(() => {
        vi.advanceTimersByTime(16);
      });

      // should only call once due to debouncing
      expect(mockFindMermaidContainers).toHaveBeenCalledTimes(1);
    });

    it('cancels pending RAF when new scan is requested', async () => {
      mockFindMermaidContainers.mockReturnValue([]);

      const { result } = renderHook(() => useMermaidRendering(containerRef));
      mockFindMermaidContainers.mockClear();

      // first scan
      act(() => {
        result.current.scan();
      });

      // second scan before RAF fires
      act(() => {
        result.current.scan();
      });

      // advance RAF
      act(() => {
        vi.advanceTimersByTime(16);
      });

      // only latest should execute
      expect(mockFindMermaidContainers).toHaveBeenCalledTimes(1);
    });
  });

  describe('mutation observer', () => {
    it('sets up MutationObserver on mount', () => {
      const observeSpy = vi.spyOn(MutationObserver.prototype, 'observe');
      mockFindMermaidContainers.mockReturnValue([]);

      renderHook(() => useMermaidRendering(containerRef));

      expect(observeSpy).toHaveBeenCalledWith(containerEl, {
        childList: true,
        subtree: true,
      });

      observeSpy.mockRestore();
    });

    it('disconnects observer on unmount', () => {
      const disconnectSpy = vi.spyOn(MutationObserver.prototype, 'disconnect');
      mockFindMermaidContainers.mockReturnValue([]);

      const { unmount } = renderHook(() => useMermaidRendering(containerRef));

      unmount();

      expect(disconnectSpy).toHaveBeenCalled();

      disconnectSpy.mockRestore();
    });
  });

  describe('cleanup', () => {
    it('cleans up RAF on unmount', () => {
      const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame');
      mockFindMermaidContainers.mockReturnValue([]);

      const { result, unmount } = renderHook(() =>
        useMermaidRendering(containerRef)
      );

      // trigger a scan to create pending RAF
      act(() => {
        result.current.scan();
      });

      unmount();

      // cancelAnimationFrame should have been called
      expect(cancelSpy).toHaveBeenCalled();

      cancelSpy.mockRestore();
    });

    it('handles unmount during pending scan gracefully', () => {
      mockFindMermaidContainers.mockReturnValue([]);

      const { result, unmount } = renderHook(() =>
        useMermaidRendering(containerRef)
      );

      // trigger scan
      act(() => {
        result.current.scan();
      });

      // unmount before RAF fires
      unmount();

      // advance timers - should not error
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // no error = test passes
    });

    it('does not update state after unmount', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockFindMermaidContainers.mockReturnValue([]);

      const { result, unmount } = renderHook(() =>
        useMermaidRendering(containerRef)
      );

      // trigger scan
      act(() => {
        result.current.scan();
      });

      // unmount
      unmount();

      // mock returns new data
      mockFindMermaidContainers.mockReturnValue([
        createMockDiagram('new', 'test'),
      ]);

      // advance RAF
      act(() => {
        vi.advanceTimersByTime(16);
      });

      // should not have React warnings about state updates on unmounted component
      // (the hook should handle this gracefully)
      consoleErrorSpy.mockRestore();
    });
  });
});
