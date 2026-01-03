// packages/webview-app/src/hooks/useScrollSync.ts
// bidirectional scroll sync between editor & preview

import { useEffect, useRef, useCallback, RefObject } from 'react';
import { ExtensionHandle } from '../rpc-webview';
import { debug } from '../utils/debug';

export interface ScrollSyncConfig {
  enabled: boolean;
  behavior: 'instant' | 'smooth';
}

interface UseScrollSyncOptions {
  contentRef: RefObject<HTMLElement | null>;
  config: ScrollSyncConfig;
}

interface LinePosition {
  line: number;
  top: number; // offsetTop relative to scroll container
}

// parse "startLine:startCol-endLine:endCol" → startLine (1-based)
export function parseSourcepos(sourcepos: string): number | null {
  const match = sourcepos.match(/^(\d+):/);
  return match ? parseInt(match[1], 10) : null;
}

// find nearest scrollable ancestor or fallback to document.scrollingElement
function findScrollParent(start: HTMLElement | null): HTMLElement {
  let el: HTMLElement | null = start;

  while (el) {
    const style = window.getComputedStyle(el);
    const overflowY = style.overflowY;
    const canScrollY =
      overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';

    if (canScrollY && el.scrollHeight > el.clientHeight) {
      return el;
    }

    el = el.parentElement;
  }

  return (document.scrollingElement as HTMLElement) || document.body;
}

// binary search: find largest index where positions[i].top <= threshold
function binarySearchTop(positions: LinePosition[], threshold: number): number {
  let lo = 0;
  let hi = positions.length - 1;
  let result = 0;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (positions[mid].top <= threshold) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return result;
}

// binary search: find largest startLine <= targetLine
export function findNearestLine(
  sortedLines: number[],
  targetLine: number
): number | null {
  if (sortedLines.length === 0) {
    return null;
  }

  let lo = 0;
  let hi = sortedLines.length - 1;
  let result = -1;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (sortedLines[mid] <= targetLine) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  // if no line <= targetLine, use first element
  return result >= 0 ? sortedLines[result] : sortedLines[0];
}

export function useScrollSync({ contentRef, config }: UseScrollSyncOptions) {
  // line → element map (first element for each startLine wins)
  const lineMapRef = useRef<Map<number, HTMLElement>>(new Map());
  // sorted start lines for binary search in findNearestLine
  const sortedLinesRef = useRef<number[]>([]);
  // sorted positions for binary search in reportVisibleLine
  const linePositionsRef = useRef<LinePosition[]>([]);
  // scroll container reference
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  // cooldown flag for loop prevention
  const cooldownRef = useRef(false);
  // pending scroll line (retry after rebuildMap if element not found)
  const pendingScrollLineRef = useRef<number | null>(null);
  // last reported line (avoid duplicate RPC calls)
  const lastReportedLineRef = useRef<number | null>(null);
  // rAF throttle ID
  const rafIdRef = useRef<number | null>(null);

  // get or find scroll container
  const getScrollContainer = useCallback((): HTMLElement => {
    if (!scrollContainerRef.current) {
      scrollContainerRef.current = findScrollParent(contentRef.current);
    }
    return scrollContainerRef.current;
  }, [contentRef]);

  // find element for a given line (binary search for nearest above)
  const findElementForLine = useCallback(
    (targetLine: number): HTMLElement | null => {
      const nearestLine = findNearestLine(sortedLinesRef.current, targetLine);
      if (nearestLine === null) {
        return null;
      }
      return lineMapRef.current.get(nearestLine) || null;
    },
    []
  );

  // handle scrollToLine from extension (1-based line number)
  const handleScrollToLine = useCallback(
    (line: number) => {
      debug(
        `[SCROLL-SYNC] handleScrollToLine called: ${line}, enabled=${config.enabled}`
      );
      debug(
        `[SCROLL-SYNC] sortedLines: ${sortedLinesRef.current.length} entries`
      );

      if (!config.enabled) {
        debug(`[SCROLL-SYNC] scroll sync disabled, ignoring`);
        return;
      }

      debug(`[SCROLL-SYNC] scrollToLine: ${line}`);

      const element = findElementForLine(line);
      if (element) {
        debug(`[SCROLL-SYNC] Found element for line ${line}, scrolling`);
        // set cooldown to prevent loop
        cooldownRef.current = true;
        setTimeout(() => {
          cooldownRef.current = false;
        }, 150);

        element.scrollIntoView({ behavior: config.behavior, block: 'start' });
        pendingScrollLineRef.current = null;
      } else {
        // queue for retry after next rebuildMap
        debug(`[SCROLL-SYNC] Element not found for line ${line}, queueing`);
        pendingScrollLineRef.current = line;
      }
    },
    [config.enabled, config.behavior, findElementForLine]
  );

  // report visible line to extension
  const reportVisibleLine = useCallback(() => {
    if (!config.enabled || cooldownRef.current) {
      return;
    }

    const positions = linePositionsRef.current;
    if (positions.length === 0) {
      return;
    }

    const scrollContainer = getScrollContainer();
    const scrollTop = scrollContainer.scrollTop;
    const threshold = scrollTop + 50; // small offset for better UX

    // binary search for topmost visible element
    const index = binarySearchTop(positions, threshold);
    const visibleLine = positions[index].line;

    // skip if unchanged
    if (visibleLine === lastReportedLineRef.current) {
      return;
    }

    lastReportedLineRef.current = visibleLine;
    debug(`[SCROLL-SYNC] reportVisibleLine: ${visibleLine}`);
    ExtensionHandle.revealLine(visibleLine);
  }, [config.enabled, getScrollContainer]);

  // rebuild line→element map from DOM
  const rebuildMap = useCallback(() => {
    if (!contentRef.current) {
      debug('[SCROLL-SYNC] rebuildMap: contentRef.current is null');
      return;
    }

    debug('[SCROLL-SYNC] rebuildMap called');

    // suppress scroll reporting during rebuild
    cooldownRef.current = true;

    const map = new Map<number, HTMLElement>();
    const elements = contentRef.current.querySelectorAll('[data-sourcepos]');
    debug(
      `[SCROLL-SYNC] rebuildMap: found ${elements.length} elements with data-sourcepos`
    );

    elements.forEach((el) => {
      const sourcepos = el.getAttribute('data-sourcepos');
      if (sourcepos) {
        const line = parseSourcepos(sourcepos);
        // first wins for duplicate lines
        if (line !== null && !map.has(line)) {
          map.set(line, el as HTMLElement);
        }
      }
    });

    lineMapRef.current = map;
    sortedLinesRef.current = Array.from(map.keys()).sort((a, b) => a - b);

    // compute sorted positions for binary search in reportVisibleLine
    const scrollContainer = getScrollContainer();
    const containerRect = scrollContainer.getBoundingClientRect();
    const positions: LinePosition[] = [];

    for (const [line, element] of map) {
      const rect = element.getBoundingClientRect();
      const top = rect.top - containerRect.top + scrollContainer.scrollTop;
      positions.push({ line, top });
    }
    positions.sort((a, b) => a.top - b.top);
    linePositionsRef.current = positions;

    // clear cooldown after DOM settles
    setTimeout(() => {
      cooldownRef.current = false;
    }, 200);

    // retry pending scroll
    if (pendingScrollLineRef.current !== null) {
      const line = pendingScrollLineRef.current;
      pendingScrollLineRef.current = null;
      // schedule after cooldown clears
      setTimeout(() => handleScrollToLine(line), 210);
    }
  }, [contentRef, getScrollContainer, handleScrollToLine]);

  // setup MutationObserver to rebuild map on DOM changes
  useEffect(() => {
    if (!contentRef.current) {
      return;
    }

    // initial build
    rebuildMap();

    const observer = new MutationObserver(() => {
      // coalesce via requestAnimationFrame
      requestAnimationFrame(rebuildMap);
    });

    observer.observe(contentRef.current, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [contentRef, rebuildMap]);

  // reset scroll container ref when content changes
  useEffect(() => {
    scrollContainerRef.current = null;
  }, [contentRef]);

  // setup scroll listener with rAF throttling
  useEffect(() => {
    if (!config.enabled) {
      return;
    }

    const scrollContainer = getScrollContainer();

    const handleScroll = () => {
      // use rAF for natural throttling (~16ms)
      if (rafIdRef.current !== null) {
        return;
      }

      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        reportVisibleLine();
      });
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [config.enabled, getScrollContainer, reportVisibleLine]);

  return { handleScrollToLine, rebuildMap };
}
