// packages/webview-client/src/features/preview/shared/hooks/useSourceLineHighlight.ts
// MPE-style hover highlight binding using data-source-line annotations

import { useEffect, type RefObject } from 'react';
import {
  HIGHLIGHT_ACTIVE_CLASS,
  HIGHLIGHT_LINE_CLASS,
  collectSourceLineEntries,
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

function clearHighlightClasses(container: HTMLElement): void {
  container
    .querySelectorAll(`.${HIGHLIGHT_LINE_CLASS}, .${HIGHLIGHT_ACTIVE_CLASS}`)
    .forEach((element) => {
      element.classList.remove(HIGHLIGHT_LINE_CLASS);
      element.classList.remove(HIGHLIGHT_ACTIVE_CLASS);
    });
}

function findRegisteredOwner(
  target: EventTarget | null,
  container: HTMLElement,
  registeredOwners: ReadonlySet<Element>
): Element | null {
  if (!(target instanceof Element)) {
    return null;
  }

  let current: Element | null = target;
  while (current && current !== container) {
    if (registeredOwners.has(current)) {
      return current;
    }
    current = current.parentElement;
  }

  return null;
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

    clearHighlightClasses(container);

    if (!enabled) {
      return;
    }

    if (trigger !== undefined && !trigger) {
      return;
    }

    const sourceLineEntries = collectSourceLineEntries(container);
    if (sourceLineEntries.length === 0) {
      return;
    }

    const entriesByOwner = new Map(
      sourceLineEntries.map(({ highlightElement, sourceLine }) => [
        highlightElement,
        sourceLine,
      ])
    );
    const registeredOwners = new Set(entriesByOwner.keys());
    let currentHighlightElement: Element | null = null;

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

    const onPointerOver: EventListener = (event) => {
      const pointerEvent = event as PointerEvent;
      const nextOwner = findRegisteredOwner(
        pointerEvent.target,
        container,
        registeredOwners
      );
      const previousOwner = findRegisteredOwner(
        pointerEvent.relatedTarget,
        container,
        registeredOwners
      );
      if (nextOwner !== previousOwner) {
        applySingleHighlight(nextOwner);
      }
    };

    const onPointerOut: EventListener = (event) => {
      const pointerEvent = event as PointerEvent;
      const previousOwner = findRegisteredOwner(
        pointerEvent.target,
        container,
        registeredOwners
      );
      const nextOwner = findRegisteredOwner(
        pointerEvent.relatedTarget,
        container,
        registeredOwners
      );
      if (previousOwner === nextOwner) {
        return;
      }

      previousOwner?.classList.remove(HIGHLIGHT_ACTIVE_CLASS);
      applySingleHighlight(nextOwner);
    };

    const onClick: EventListener = (event) => {
      if (!onOpenSourceLine) {
        return;
      }

      const mouseEvent = event as MouseEvent;
      const owner = findRegisteredOwner(
        mouseEvent.target,
        container,
        registeredOwners
      );
      const sourceLine = owner ? entriesByOwner.get(owner) : null;
      if (
        !owner ||
        sourceLine === null ||
        sourceLine === undefined ||
        !isSourceNavigationClick(mouseEvent) ||
        isInteractiveTarget(mouseEvent.target, container)
      ) {
        return;
      }

      mouseEvent.preventDefault();
      mouseEvent.stopPropagation();
      container
        .querySelectorAll(`.${HIGHLIGHT_ACTIVE_CLASS}`)
        .forEach((element) => element.classList.remove(HIGHLIGHT_ACTIVE_CLASS));
      owner.classList.add(HIGHLIGHT_ACTIVE_CLASS);
      onOpenSourceLine(sourceLine);
    };

    container.addEventListener('pointerover', onPointerOver);
    container.addEventListener('pointerout', onPointerOut);
    if (onOpenSourceLine) {
      container.addEventListener('click', onClick);
    }

    return () => {
      container.removeEventListener('pointerover', onPointerOver);
      container.removeEventListener('pointerout', onPointerOut);
      if (onOpenSourceLine) {
        container.removeEventListener('click', onClick);
      }
      registeredOwners.forEach((owner) => {
        owner.classList.remove(HIGHLIGHT_LINE_CLASS);
        owner.classList.remove(HIGHLIGHT_ACTIVE_CLASS);
      });
      clearHighlightClasses(container);
      currentHighlightElement = null;
    };
  }, [containerRef, trigger, enabled, onOpenSourceLine]);
}
