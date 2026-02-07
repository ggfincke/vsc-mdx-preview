// packages/webview-app/src/hooks/useGraphvizRendering.tsx
// shared hook for Graphviz rendering in Safe & Trusted modes

import {
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
  useCallback,
  RefObject,
  ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { GraphvizRenderer } from '../components/GraphvizRenderer/GraphvizRenderer';
import {
  findGraphvizContainers,
  GraphvizDiagramInfo,
} from '../utils/findGraphvizContainers';

// timing mode for Graphviz scanning
export type GraphvizScanMode = 'after-paint' | 'before-paint';

interface UseGraphvizRenderingOptions {
  // scan timing mode (Safe: after-paint, Trusted: before-paint)
  mode?: GraphvizScanMode;
  // filter stale elements removed from DOM
  filterStale?: boolean;
}

interface UseGraphvizRenderingResult {
  // found Graphviz diagrams
  diagrams: GraphvizDiagramInfo[];
  // render Graphviz portals
  renderPortals: () => ReactNode[];
  // manually trigger scan
  scan: () => void;
}

// hook for Graphviz detection & portal rendering
export function useGraphvizRendering(
  containerRef: RefObject<HTMLElement | null>,
  options: UseGraphvizRenderingOptions = {}
): UseGraphvizRenderingResult {
  const { mode = 'after-paint', filterStale = false } = options;
  const [diagrams, setDiagrams] = useState<GraphvizDiagramInfo[]>([]);
  const observerRef = useRef<MutationObserver | null>(null);
  const rafIdRef = useRef<number | null>(null);

  // scan for Graphviz containers & update state (debounced w/ RAF)
  const scan = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }

    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;

      if (!containerRef.current) {
        return;
      }

      let found = findGraphvizContainers(containerRef.current);
      if (filterStale) {
        found = found.filter((diagram) => containerRef.current!.contains(diagram.el));
      }

      setDiagrams(found);
    });
  }, [containerRef, filterStale]);

  // render Graphviz portals w/ correct key placement
  const renderPortals = useCallback(
    (): ReactNode[] =>
      diagrams.map((diagram) =>
        createPortal(
          <GraphvizRenderer
            id={diagram.id}
            code={diagram.code}
            language={diagram.language}
          />,
          diagram.el,
          diagram.id
        )
      ),
    [diagrams]
  );

  const useEffectHook = mode === 'before-paint' ? useLayoutEffect : useEffect;

  // set up MutationObserver to detect dynamic content changes
  useEffectHook(() => {
    if (!containerRef.current) {
      return;
    }

    let found = findGraphvizContainers(containerRef.current);
    if (filterStale) {
      found = found.filter((diagram) =>
        containerRef.current!.contains(diagram.el)
      );
    }
    setDiagrams(found);

    observerRef.current = new MutationObserver(() => {
      scan();
    });

    observerRef.current.observe(containerRef.current, {
      childList: true,
      subtree: true,
    });

    return () => {
      observerRef.current?.disconnect();
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [containerRef, scan, filterStale]);

  return { diagrams, renderPortals, scan };
}
