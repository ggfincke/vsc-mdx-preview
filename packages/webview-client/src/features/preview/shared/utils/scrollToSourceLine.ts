// packages/webview-client/src/features/preview/shared/utils/scrollToSourceLine.ts
// scroll preview content to the closest rendered source-line element

import { SOURCE_LINE_SCROLL_SYNC_ANCHOR_RATIO } from '@mdx-preview/contracts';
import { PREVIEW_CONTENT_CLASS } from '../../../../app/constants';
import {
  scheduleFrame,
  cancelScheduledFrame,
  type ScheduledFrame,
} from '../../../../shared/utils/frameScheduler';
import {
  SOURCE_LINE_SELECTOR,
  getDataSourceLine,
  resolveHighlightOwner,
  type SourceLineEntry,
} from './sourceLineElements';

const MARKDOWN_BODY_SELECTOR = '.markdown-body';
const MIN_SCROLL_ANCHOR_OFFSET_PX = 60;
const SCROLL_ANIMATION_MS = 120;
const MIN_SCROLL_DELTA_PX = 2;
const PENDING_SCROLL_TTL_MS = 10000;
const PROGRAMMATIC_SCROLL_SETTLE_MS = 80;

let pendingScrollLine: number | undefined;
let pendingScrollRequestedAtMs = 0;
let pendingScrollFrame: ScheduledFrame | undefined;
let programmaticScrollUntilMs = 0;

interface ScrollAnimation {
  frame: ScheduledFrame | undefined;
  startTop: number;
  targetTop: number;
  startTime: number | undefined;
}

let activeScrollAnimation: ScrollAnimation | undefined;

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

function easeScrollProgress(progress: number): number {
  return 1 - Math.pow(1 - progress, 3);
}

function setWindowScrollTop(top: number): void {
  window.scrollTo({ top, behavior: 'auto' });
}

function getViewportHeight(): number {
  return document.documentElement.clientHeight || window.innerHeight;
}

function getScrollAnchorOffset(): number {
  return Math.max(
    MIN_SCROLL_ANCHOR_OFFSET_PX,
    getViewportHeight() * SOURCE_LINE_SCROLL_SYNC_ANCHOR_RATIO
  );
}

function cancelActiveScrollAnimation(): void {
  if (activeScrollAnimation?.frame) {
    cancelScheduledFrame(activeScrollAnimation.frame);
  }
  activeScrollAnimation = undefined;
}

function clearPendingScroll(): void {
  pendingScrollLine = undefined;
  pendingScrollRequestedAtMs = 0;
}

function markProgrammaticScrollSettled(): void {
  programmaticScrollUntilMs = Date.now() + PROGRAMMATIC_SCROLL_SETTLE_MS;
}

function hasExpiredPendingScroll(): boolean {
  return (
    pendingScrollLine !== undefined &&
    Date.now() - pendingScrollRequestedAtMs > PENDING_SCROLL_TTL_MS
  );
}

function isProgrammaticScrollSettling(): boolean {
  const remainingMs = programmaticScrollUntilMs - Date.now();
  if (remainingMs <= 0) {
    programmaticScrollUntilMs = 0;
    return false;
  }
  if (remainingMs > PROGRAMMATIC_SCROLL_SETTLE_MS) {
    programmaticScrollUntilMs = 0;
    return false;
  }
  return true;
}

export function isSourceLineScrollInProgress(): boolean {
  if (hasExpiredPendingScroll()) {
    clearPendingScroll();
  }
  return (
    pendingScrollLine !== undefined ||
    activeScrollAnimation !== undefined ||
    isProgrammaticScrollSettling()
  );
}

function animateWindowScrollTo(targetTop: number): void {
  const startTop = window.scrollY;
  if (Math.abs(targetTop - startTop) <= MIN_SCROLL_DELTA_PX) {
    cancelActiveScrollAnimation();
    setWindowScrollTop(targetTop);
    markProgrammaticScrollSettled();
    return;
  }

  cancelActiveScrollAnimation();
  activeScrollAnimation = {
    frame: undefined,
    startTop,
    targetTop,
    startTime: undefined,
  };

  const step = (time: number): void => {
    const animation = activeScrollAnimation;
    if (!animation) {
      return;
    }

    animation.startTime ??= time;
    const progress = Math.min(
      1,
      (time - animation.startTime) / SCROLL_ANIMATION_MS
    );
    const easedProgress = easeScrollProgress(progress);
    const top =
      animation.startTop +
      (animation.targetTop - animation.startTop) * easedProgress;
    setWindowScrollTop(top);

    if (progress >= 1) {
      activeScrollAnimation = undefined;
      markProgrammaticScrollSettled();
      return;
    }

    animation.frame = scheduleFrame(step);
  };

  activeScrollAnimation.frame = scheduleFrame(step);
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
  const top = Math.max(0, rect.top + window.scrollY - getScrollAnchorOffset());
  animateWindowScrollTo(top);
  return true;
}

export function scheduleScrollToSourceLine(sourceLine: number): void {
  if (!Number.isFinite(sourceLine) || sourceLine < 1) {
    return;
  }

  pendingScrollLine = sourceLine;
  pendingScrollRequestedAtMs = Date.now();
  if (pendingScrollFrame) {
    // burst coalescing: when the extension dispatches multiple targets in the
    // same frame only the newest survives. landing on the latest line beats
    // animating through stale intermediate lines that no longer match the
    // editor's current scroll position
    return;
  }

  pendingScrollFrame = scheduleFrame(() => {
    pendingScrollFrame = undefined;
    flushPendingScrollToSourceLine();
  });
}

export function flushPendingScrollToSourceLine(): boolean {
  if (hasExpiredPendingScroll()) {
    clearPendingScroll();
    return false;
  }

  const line = pendingScrollLine;
  if (line === undefined) {
    return false;
  }

  if (!scrollToSourceLine(line)) {
    return false;
  }

  clearPendingScroll();
  return true;
}
