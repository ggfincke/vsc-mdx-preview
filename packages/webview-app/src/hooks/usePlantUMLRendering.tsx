// packages/webview-app/src/hooks/usePlantUMLRendering.tsx
// shared hook for PlantUML rendering in Safe & Trusted modes

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
import { PlantUMLRenderer } from '../components/PlantUMLRenderer/PlantUMLRenderer';
import {
  findPlantUMLContainers,
  PlantUMLDiagramInfo,
} from '../utils/findPlantUMLContainers';

// timing mode for PlantUML scanning
export type PlantUMLScanMode = 'after-paint' | 'before-paint';

interface UsePlantUMLRenderingOptions {
  // scan timing mode (Safe: after-paint, Trusted: before-paint)
  mode?: PlantUMLScanMode;
  // filter stale elements removed from DOM
  filterStale?: boolean;
}

interface UsePlantUMLRenderingResult {
  // found PlantUML diagrams
  diagrams: PlantUMLDiagramInfo[];
  // render PlantUML portals
  renderPortals: () => ReactNode[];
  // manually trigger scan
  scan: () => void;
}

// hook for PlantUML detection & portal rendering
export function usePlantUMLRendering(
  containerRef: RefObject<HTMLElement | null>,
  options: UsePlantUMLRenderingOptions = {}
): UsePlantUMLRenderingResult {
  const { mode = 'after-paint', filterStale = false } = options;
  const [diagrams, setDiagrams] = useState<PlantUMLDiagramInfo[]>([]);
  const observerRef = useRef<MutationObserver | null>(null);
  const rafIdRef = useRef<number | null>(null);

  // scan for PlantUML containers & update state (debounced w/ RAF)
  const scan = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }

    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;

      if (!containerRef.current) {
        return;
      }

      let found = findPlantUMLContainers(containerRef.current);
      if (filterStale) {
        found = found.filter((diagram) => containerRef.current!.contains(diagram.el));
      }

      setDiagrams(found);
    });
  }, [containerRef, filterStale]);

  // render PlantUML portals w/ correct key placement
  const renderPortals = useCallback(
    (): ReactNode[] =>
      diagrams.map((diagram) =>
        createPortal(
          <PlantUMLRenderer id={diagram.id} code={diagram.code} />,
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

    let found = findPlantUMLContainers(containerRef.current);
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
