// packages/webview-app/src/hooks/useMermaidRendering.tsx
// shared hook for Mermaid diagram rendering in Safe & Trusted modes

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
import { MermaidRenderer } from '../components/MermaidRenderer';
import {
  findMermaidContainers,
  MermaidDiagramInfo,
} from '../utils/findMermaidContainers';

// timing mode for mermaid scanning
export type MermaidScanMode = 'after-paint' | 'before-paint';

interface UseMermaidRenderingOptions {
  // 'after-paint' (useEffect) for Safe Mode, 'before-paint' (useLayoutEffect) for Trusted Mode
  mode?: MermaidScanMode;
  // filter out stale elements no longer in DOM (needed for Trusted Mode dynamic rendering)
  filterStale?: boolean;
}

interface UseMermaidRenderingResult {
  // array of found mermaid diagrams
  diagrams: MermaidDiagramInfo[];
  // render mermaid portals (call in JSX)
  renderPortals: () => ReactNode[];
  // manually trigger a scan (optional)
  scan: () => void;
}

// hook for mermaid diagram detection & portal rendering
export function useMermaidRendering(
  containerRef: RefObject<HTMLElement | null>,
  options: UseMermaidRenderingOptions = {}
): UseMermaidRenderingResult {
  const { mode = 'after-paint', filterStale = false } = options;
  const [diagrams, setDiagrams] = useState<MermaidDiagramInfo[]>([]);
  const observerRef = useRef<MutationObserver | null>(null);
  const rafIdRef = useRef<number | null>(null);

  // scan for mermaid containers & update state (debounced w/ RAF)
  const scan = useCallback(() => {
    // cancel pending RAF to debounce rapid mutations
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }

    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;

      if (!containerRef.current) {
        return;
      }

      let found = findMermaidContainers(containerRef.current);

      // filter stale elements (removed from DOM during re-render)
      if (filterStale) {
        found = found.filter((d) => containerRef.current!.contains(d.el));
      }

      setDiagrams(found);
    });
  }, [containerRef, filterStale]);

  // render mermaid portals w/ correct key placement
  const renderPortals = useCallback(
    (): ReactNode[] =>
      diagrams.map((diagram) =>
        // key must be on portal (3rd arg), not on child element
        createPortal(
          <MermaidRenderer id={diagram.id} code={diagram.code} />,
          diagram.el,
          diagram.id
        )
      ),
    [diagrams]
  );

  // select hook based on mode
  const useEffectHook = mode === 'before-paint' ? useLayoutEffect : useEffect;

  // set up MutationObserver to detect dynamic content changes
  useEffectHook(() => {
    if (!containerRef.current) {
      return;
    }

    // initial scan (not debounced for first paint)
    let found = findMermaidContainers(containerRef.current);
    if (filterStale) {
      found = found.filter((d) => containerRef.current!.contains(d.el));
    }
    setDiagrams(found);

    // observe for changes (debounced via scan)
    observerRef.current = new MutationObserver(() => {
      scan();
    });

    observerRef.current.observe(containerRef.current, {
      childList: true,
      subtree: true,
    });

    return () => {
      observerRef.current?.disconnect();
      // clean up any pending RAF
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [containerRef, scan, filterStale]);

  return { diagrams, renderPortals, scan };
}
