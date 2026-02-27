// packages/webview-app/src/hooks/useSourceLineHighlight.ts
// MPE-style hover highlight binding using data-source-line annotations

import { useEffect, type RefObject } from 'react';

const SOURCE_LINE_SELECTOR = '[data-source-line]';
const HIGHLIGHT_LINE_CLASS = 'highlight-line';
const HIGHLIGHT_ACTIVE_CLASS = 'highlight-active';
const CALLOUT_OWNER_SELECTOR = [
  '.mdx-safe-callout',
  '.mdx-preview-admonition',
  '.github-alert',
  '[data-callout-type]',
  '.mdx-preview-nextra-callout',
  '.mdx-preview-nextra-callout-wrapper',
].join(', ');

function getDataSourceLine(element: Element): number | null {
  const dataLine = element.getAttribute('data-source-line');
  if (!dataLine) {
    return null;
  }
  const line = Number.parseInt(dataLine, 10);
  return Number.isFinite(line) ? line : null;
}

interface UseSourceLineHighlightOptions {
  containerRef: RefObject<HTMLElement | null>;
  trigger?: unknown;
  enabled?: boolean;
}

interface SourceLineEntry {
  sourceLineElement: Element;
  highlightElement: Element;
  dataSourceLine: number;
}

function resolveCalloutOwner(
  sourceLineElement: Element,
  root: HTMLElement
): Element | null {
  const calloutOwner = sourceLineElement.closest(CALLOUT_OWNER_SELECTOR);
  if (!calloutOwner || !root.contains(calloutOwner)) {
    return null;
  }

  if (calloutOwner.classList.contains('mdx-preview-nextra-callout-wrapper')) {
    const promotedOwner = Array.from(calloutOwner.children).find((child) =>
      child.classList.contains('mdx-preview-nextra-callout')
    );
    if (promotedOwner && root.contains(promotedOwner)) {
      return promotedOwner;
    }
  }

  return calloutOwner;
}

function resolveHighlightOwner(
  sourceLineElement: Element,
  root: HTMLElement
): Element | null {
  const table = sourceLineElement.closest('table');
  if (table && root.contains(table)) {
    // table highlighting is intentionally disabled
    return null;
  }

  const calloutOwner = resolveCalloutOwner(sourceLineElement, root);
  if (calloutOwner) {
    return calloutOwner;
  }

  const listItem = sourceLineElement.closest('li');
  if (listItem && root.contains(listItem)) {
    return listItem;
  }

  if (sourceLineElement.tagName === 'IMG') {
    return sourceLineElement.parentElement ?? sourceLineElement;
  }

  if (sourceLineElement.parentElement?.tagName === 'P') {
    return sourceLineElement.parentElement;
  }

  return sourceLineElement;
}

function collectSourceLineEntries(container: HTMLElement): SourceLineEntry[] {
  const sourceLineElements = Array.from(
    container.querySelectorAll(SOURCE_LINE_SELECTOR)
  );
  const seenLinesByOwner = new Map<Element, Set<number>>();
  const entries: SourceLineEntry[] = [];

  sourceLineElements.forEach((sourceLineElement) => {
    // avoid interfering with inline links
    if (sourceLineElement.tagName === 'A') {
      return;
    }

    const dataSourceLine = getDataSourceLine(sourceLineElement);
    if (dataSourceLine === null) {
      return;
    }

    const highlightElement = resolveHighlightOwner(
      sourceLineElement,
      container
    );
    if (!highlightElement) {
      return;
    }

    const seenLines =
      seenLinesByOwner.get(highlightElement) ?? new Set<number>();
    if (seenLines.has(dataSourceLine)) {
      return;
    }
    seenLines.add(dataSourceLine);
    seenLinesByOwner.set(highlightElement, seenLines);

    entries.push({
      sourceLineElement,
      highlightElement,
      dataSourceLine,
    });
  });

  return entries;
}

export function useSourceLineHighlight({
  containerRef,
  trigger,
  enabled = true,
}: UseSourceLineHighlightOptions): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    if (!enabled) {
      const existingHighlights = Array.from(
        container.getElementsByClassName(HIGHLIGHT_LINE_CLASS)
      );
      existingHighlights.forEach((element) => {
        element.classList.remove(HIGHLIGHT_LINE_CLASS);
        element.classList.remove(HIGHLIGHT_ACTIVE_CLASS);
      });
      return;
    }

    if (trigger !== undefined ? !trigger : false) {
      return;
    }

    const sourceLineEntries = collectSourceLineEntries(container);
    if (sourceLineEntries.length === 0) {
      return;
    }

    const addedEventsSet = new Set<Element>();
    let currentHighlightElement: Element | null = null;
    const listeners: Array<{
      element: Element;
      onMouseEnter: EventListener;
      onMouseLeave: EventListener;
    }> = [];

    const applySingleHighlight = (highlightElement: Element | null): void => {
      if (currentHighlightElement === highlightElement) {
        return;
      }

      const currentHighlightElements = Array.from(
        container.getElementsByClassName(HIGHLIGHT_LINE_CLASS)
      );
      currentHighlightElements.forEach((currentHighlightElement) => {
        currentHighlightElement.classList.remove(HIGHLIGHT_LINE_CLASS);
      });

      currentHighlightElement = highlightElement;
      if (highlightElement) {
        highlightElement.classList.add(HIGHLIGHT_LINE_CLASS);
      }
    };

    const findRegisteredOwner = (
      target: EventTarget | null
    ): Element | null => {
      if (!(target instanceof Element)) {
        return null;
      }

      let current: Element | null = target;
      while (current && current !== container) {
        if (addedEventsSet.has(current)) {
          return current;
        }
        current = current.parentElement;
      }

      return null;
    };

    const bindHighlightElementEvent = (highlightElement: Element): void => {
      if (addedEventsSet.has(highlightElement)) {
        return;
      }
      addedEventsSet.add(highlightElement);

      const onMouseEnter: EventListener = () => {
        applySingleHighlight(highlightElement);
      };

      const onMouseLeave: EventListener = (event) => {
        const nextOwner = findRegisteredOwner(
          (event as MouseEvent).relatedTarget
        );
        if (nextOwner) {
          applySingleHighlight(nextOwner);
          return;
        }

        if (currentHighlightElement === highlightElement) {
          applySingleHighlight(null);
        }
        highlightElement.classList.remove(HIGHLIGHT_ACTIVE_CLASS);
      };

      highlightElement.addEventListener('mouseenter', onMouseEnter);
      highlightElement.addEventListener('mouseleave', onMouseLeave);
      listeners.push({ element: highlightElement, onMouseEnter, onMouseLeave });
    };

    sourceLineEntries.forEach(({ highlightElement }) => {
      bindHighlightElementEvent(highlightElement);
    });

    return () => {
      listeners.forEach(({ element, onMouseEnter, onMouseLeave }) => {
        element.removeEventListener('mouseenter', onMouseEnter);
        element.removeEventListener('mouseleave', onMouseLeave);
        element.classList.remove(HIGHLIGHT_LINE_CLASS);
        element.classList.remove(HIGHLIGHT_ACTIVE_CLASS);
      });
      currentHighlightElement = null;
    };
  }, [containerRef, trigger, enabled]);
}

export default useSourceLineHighlight;
