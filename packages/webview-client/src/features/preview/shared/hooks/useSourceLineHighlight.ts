// packages/webview-client/src/features/preview/shared/hooks/useSourceLineHighlight.ts
// MPE-style hover highlight binding using data-source-line annotations

import { useEffect, type RefObject } from 'react';
import {
  HIGHLIGHT_ACTIVE_CLASS,
  HIGHLIGHT_LINE_CLASS,
  collectSourceLineEntries,
  type SourceLineEntry,
} from '../utils/sourceLineElements';

const INTERACTIVE_SELECTOR = [
  'a',
  'button',
  'input',
  'select',
  'textarea',
  'label',
  'details',
  'summary',
  '[role="button"]',
  '[contenteditable]',
].join(', ');

function isInteractiveTarget(
  target: EventTarget | null,
  root: HTMLElement
): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  const interactiveElement = target.closest(INTERACTIVE_SELECTOR);
  return !!interactiveElement && root.contains(interactiveElement);
}

function isSourceNavigationClick(event: MouseEvent): boolean {
  return event.button === 0 && (event.ctrlKey || event.metaKey);
}

interface UseSourceLineHighlightOptions {
  containerRef: RefObject<HTMLElement | null>;
  trigger?: unknown;
  enabled?: boolean;
  onOpenSourceLine?: (line: number) => void;
}

export function useSourceLineHighlight({
  containerRef,
  trigger,
  enabled = true,
  onOpenSourceLine,
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
      onClick: EventListener | undefined;
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

    const bindEntry = ({ highlightElement, sourceLine }: SourceLineEntry) => {
      // addedEventsSet powers findRegisteredOwner's ancestor lookup on mouseleave
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

      const onClick: EventListener | undefined =
        onOpenSourceLine && sourceLine !== null
          ? (event) => {
              const mouseEvent = event as MouseEvent;
              if (
                !isSourceNavigationClick(mouseEvent) ||
                isInteractiveTarget(mouseEvent.target, container)
              ) {
                return;
              }

              mouseEvent.preventDefault();
              mouseEvent.stopPropagation();
              highlightElement.classList.add(HIGHLIGHT_ACTIVE_CLASS);
              onOpenSourceLine(sourceLine);
            }
          : undefined;

      highlightElement.addEventListener('mouseenter', onMouseEnter);
      highlightElement.addEventListener('mouseleave', onMouseLeave);
      if (onClick) {
        highlightElement.addEventListener('click', onClick);
      }
      listeners.push({
        element: highlightElement,
        onMouseEnter,
        onMouseLeave,
        onClick,
      });
    };

    sourceLineEntries.forEach(bindEntry);

    return () => {
      listeners.forEach(({ element, onMouseEnter, onMouseLeave, onClick }) => {
        element.removeEventListener('mouseenter', onMouseEnter);
        element.removeEventListener('mouseleave', onMouseLeave);
        if (onClick) {
          element.removeEventListener('click', onClick);
        }
        element.classList.remove(HIGHLIGHT_LINE_CLASS);
        element.classList.remove(HIGHLIGHT_ACTIVE_CLASS);
      });
      currentHighlightElement = null;
    };
  }, [containerRef, trigger, enabled, onOpenSourceLine]);
}

export default useSourceLineHighlight;
