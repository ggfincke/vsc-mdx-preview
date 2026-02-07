// packages/webview-app/src/hooks/createDiagramRendering.tsx
// factory for creating diagram rendering hooks (detection, scanning & portal rendering)

import {
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
  useCallback,
  type RefObject,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import type { BaseDiagramInfo } from '../utils/createDiagramContainerFinder';

// timing mode for diagram scanning
export type DiagramScanMode = 'after-paint' | 'before-paint';

interface UseDiagramRenderingOptions {
  // scan timing mode (Safe: after-paint, Trusted: before-paint)
  mode?: DiagramScanMode;
  // filter stale elements removed from DOM
  filterStale?: boolean;
}

interface UseDiagramRenderingResult<T extends BaseDiagramInfo> {
  // found diagrams
  diagrams: T[];
  // render diagram portals
  renderPortals: () => ReactNode[];
  // manually trigger scan
  scan: () => void;
}

// configuration for the diagram rendering hook factory
interface DiagramRenderingConfig<T extends BaseDiagramInfo> {
  // finder function to locate diagram containers in DOM
  findContainers: (root: ParentNode) => T[];
  // render a single diagram element (used inside createPortal)
  renderElement: (diagram: T) => ReactNode;
}

// create a diagram rendering hook w/ scanning, observation & portal rendering
export function createDiagramRendering<T extends BaseDiagramInfo>(
  config: DiagramRenderingConfig<T>
) {
  return function useDiagramRendering(
    containerRef: RefObject<HTMLElement | null>,
    options: UseDiagramRenderingOptions = {}
  ): UseDiagramRenderingResult<T> {
    const { mode = 'after-paint', filterStale = false } = options;
    const [diagrams, setDiagrams] = useState<T[]>([]);
    const observerRef = useRef<MutationObserver | null>(null);
    const rafIdRef = useRef<number | null>(null);

    // scan for diagram containers & update state (debounced w/ RAF)
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

        let found = config.findContainers(containerRef.current);

        // filter stale elements (removed from DOM during re-render)
        if (filterStale) {
          found = found.filter((d) =>
            containerRef.current!.contains(d.el)
          );
        }

        setDiagrams(found);
      });
    }, [containerRef, filterStale]);

    // render diagram portals w/ correct key placement
    const renderPortals = useCallback(
      (): ReactNode[] =>
        diagrams.map((diagram) =>
          // key must be on portal (3rd arg), not on child element
          createPortal(
            config.renderElement(diagram),
            diagram.el,
            diagram.id
          )
        ),
      [diagrams]
    );

    // select hook based on mode
    const useEffectHook =
      mode === 'before-paint' ? useLayoutEffect : useEffect;

    // set up MutationObserver to detect dynamic content changes
    useEffectHook(() => {
      if (!containerRef.current) {
        return;
      }

      // initial scan (not debounced for first paint)
      let found = config.findContainers(containerRef.current);
      if (filterStale) {
        found = found.filter((d) =>
          containerRef.current!.contains(d.el)
        );
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
  };
}
