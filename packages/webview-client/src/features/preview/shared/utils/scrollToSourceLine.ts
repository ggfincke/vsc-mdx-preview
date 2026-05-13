// packages/webview-client/src/features/preview/shared/utils/scrollToSourceLine.ts
// scroll preview content to the closest rendered source-line element

import { PREVIEW_CONTENT_CLASS } from '../../../../app/constants';
import {
  SOURCE_LINE_SELECTOR,
  getDataSourceLine,
  resolveHighlightOwner,
  type SourceLineEntry,
} from './sourceLineElements';

const MARKDOWN_BODY_SELECTOR = '.markdown-body';
const SCROLL_OFFSET_PX = 60;

let pendingScrollLine: number | undefined;
let pendingScrollFrame = 0;

function getPreviewContentRoot(): HTMLElement | null {
  const content = document.querySelector(`.${PREVIEW_CONTENT_CLASS}`);
  if (!(content instanceof HTMLElement)) {
    return null;
  }

  const markdownBody = content.querySelector(MARKDOWN_BODY_SELECTOR);
  return markdownBody instanceof HTMLElement ? markdownBody : content;
}

function buildEntry(
  element: Element,
  container: HTMLElement,
  sourceLine: number
): SourceLineEntry | null {
  const owner = resolveHighlightOwner(element, container);
  return owner ? { highlightElement: owner, sourceLine } : null;
}

export function findBestSourceLineEntry(
  container: HTMLElement,
  sourceLine: number
): SourceLineEntry | null {
  // fast path: element annotated w/ the exact line
  // sourceLine is a finite integer so the attribute selector needs no escaping
  const exact = container.querySelector(`[data-source-line="${sourceLine}"]`);
  if (
    exact &&
    exact.tagName !== 'A' &&
    getDataSourceLine(exact) === sourceLine
  ) {
    const entry = buildEntry(exact, container, sourceLine);
    if (entry) {
      return entry;
    }
  }

  // fallback: pick the nearest mapped element by line distance
  let beforeElement: Element | null = null;
  let beforeLine = Number.NEGATIVE_INFINITY;
  let afterElement: Element | null = null;
  let afterLine = Number.POSITIVE_INFINITY;

  for (const element of container.querySelectorAll(SOURCE_LINE_SELECTOR)) {
    if (element.tagName === 'A') {
      continue;
    }
    const line = getDataSourceLine(element);
    if (line === null) {
      continue;
    }

    if (line < sourceLine && line > beforeLine) {
      beforeLine = line;
      beforeElement = element;
    } else if (line > sourceLine && line < afterLine) {
      afterLine = line;
      afterElement = element;
    }
  }

  let chosenElement: Element | null;
  let chosenLine: number;
  if (beforeElement && afterElement) {
    // tie-break toward the previous mapped element so we don't scroll past
    chosenElement =
      sourceLine - beforeLine <= afterLine - sourceLine
        ? beforeElement
        : afterElement;
    chosenLine = chosenElement === beforeElement ? beforeLine : afterLine;
  } else if (beforeElement) {
    chosenElement = beforeElement;
    chosenLine = beforeLine;
  } else if (afterElement) {
    chosenElement = afterElement;
    chosenLine = afterLine;
  } else {
    return null;
  }

  return buildEntry(chosenElement, container, chosenLine);
}

export function scrollToSourceLine(sourceLine: number): boolean {
  if (!Number.isFinite(sourceLine) || sourceLine < 1) {
    return false;
  }

  const container = getPreviewContentRoot();
  if (!container) {
    return false;
  }

  const entry = findBestSourceLineEntry(container, sourceLine);
  if (!entry) {
    return false;
  }

  const rect = entry.highlightElement.getBoundingClientRect();
  const top = Math.max(0, rect.top + window.scrollY - SCROLL_OFFSET_PX);
  window.scrollTo({ top, behavior: 'auto' });
  return true;
}

function requestScrollFrame(callback: FrameRequestCallback): number {
  if (typeof window.requestAnimationFrame === 'function') {
    return window.requestAnimationFrame(callback);
  }

  return window.setTimeout(() => callback(Date.now()), 0);
}

export function scheduleScrollToSourceLine(sourceLine: number): void {
  if (!Number.isFinite(sourceLine) || sourceLine < 1) {
    return;
  }

  pendingScrollLine = sourceLine;
  if (pendingScrollFrame !== 0) {
    return;
  }

  pendingScrollFrame = requestScrollFrame(() => {
    const line = pendingScrollLine;
    pendingScrollLine = undefined;
    pendingScrollFrame = 0;
    if (line !== undefined) {
      scrollToSourceLine(line);
    }
  });
}
