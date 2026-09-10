// packages/webview-client/src/features/diagrams/hooks/useDiagramScanCoordinator.tsx
// single-observer diagram scan coordinator for preview containers

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import type { BaseDiagramInfo } from '../utils/createDiagramContainerFinder';
import type { DiagramScanAdapter } from './diagramAdapters';

export type DiagramScanMode = 'after-paint' | 'before-paint';

interface UseDiagramScanCoordinatorOptions {
  // scan timing mode (Safe: after-paint, Trusted: before-paint)
  mode?: DiagramScanMode;
  // filter out diagram elements no longer attached to preview container
  filterStale?: boolean;
  // diagram extraction/render adapters
  adapters: readonly DiagramScanAdapter[];
}

interface DiagramGroupState {
  adapterKey: string;
  renderElement: (diagram: BaseDiagramInfo) => ReactNode;
  diagrams: BaseDiagramInfo[];
}

interface UseDiagramScanCoordinatorResult {
  // render all diagram portals
  renderPortals: () => ReactNode[];
  // force immediate rescan
  scan: () => void;
}

// structural equality check so unchanged scans skip the state update
// (renderElement identity is stable from module-const adapters)
function areGroupsEqual(
  prev: DiagramGroupState[],
  next: DiagramGroupState[]
): boolean {
  if (prev.length !== next.length) {
    return false;
  }
  return prev.every((prevGroup, i) => {
    const nextGroup = next[i];
    if (
      prevGroup.adapterKey !== nextGroup.adapterKey ||
      prevGroup.diagrams.length !== nextGroup.diagrams.length
    ) {
      return false;
    }
    return prevGroup.diagrams.every((prevDiagram, j) => {
      const nextDiagram = nextGroup.diagrams[j];
      return (
        prevDiagram.el === nextDiagram.el &&
        prevDiagram.id === nextDiagram.id &&
        prevDiagram.code === nextDiagram.code
      );
    });
  });
}

export function useDiagramScanCoordinator(
  container: HTMLElement | null,
  options: UseDiagramScanCoordinatorOptions
): UseDiagramScanCoordinatorResult {
  const { mode = 'after-paint', filterStale = false, adapters } = options;
  const [groups, setGroups] = useState<DiagramGroupState[]>([]);
  const rafIdRef = useRef<number | null>(null);

  const runScan = useCallback(() => {
    if (!container) {
      setGroups((prev) => (prev.length === 0 ? prev : []));
      return;
    }

    const nextGroups: DiagramGroupState[] = adapters.map((adapter) => {
      let diagrams = adapter.findContainers(container);
      if (filterStale) {
        diagrams = diagrams.filter((diagram) => container.contains(diagram.el));
      }
      return {
        adapterKey: adapter.key,
        renderElement: adapter.renderElement,
        diagrams,
      };
    });

    // one state update per scan batch; keep prev state when structurally unchanged
    setGroups((prev) => (areGroupsEqual(prev, nextGroups) ? prev : nextGroups));
  }, [adapters, container, filterStale]);

  const scheduleScan = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }

    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      runScan();
    });
  }, [runScan]);

  const scan = useCallback(() => {
    // immediate scan request should supersede pending debounced scan
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    runScan();
  }, [runScan]);

  const renderPortals = useCallback(
    (): ReactNode[] =>
      groups.flatMap((group) =>
        group.diagrams
          .filter((diagram) => container?.contains(diagram.el))
          .map((diagram) =>
            createPortal(
              group.renderElement(diagram),
              diagram.el,
              `${group.adapterKey}:${diagram.id}`
            )
          )
      ),
    [container, groups]
  );

  const useEffectHook = mode === 'before-paint' ? useLayoutEffect : useEffect;

  useEffectHook(() => {
    runScan();
    if (!container) {
      return;
    }

    let active = true;
    const observer = new MutationObserver(() => {
      if (active) {
        scheduleScan();
      }
    });
    observer.observe(container, {
      childList: true,
      subtree: true,
    });

    return () => {
      active = false;
      observer.disconnect();
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [container, runScan, scheduleScan]);

  return {
    renderPortals,
    scan,
  };
}
