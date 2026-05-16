// packages/webview-client/src/features/preview/shared/hooks/usePreviewScrollSync.ts
// report active preview source lines for preview-to-editor scroll sync

import { useEffect, type RefObject } from 'react';
import {
  isPreviewToEditorMode,
  LogTags,
  SOURCE_LINE_SCROLL_SYNC_ANCHOR_RATIO,
  type PreviewSourceLineReportResult,
  type PreviewScrollSyncValue,
} from '@mdx-preview/contracts';
import { createTaggedLogger } from '../../../../shared/utils/createTaggedLogger';
import {
  scheduleFrame,
  cancelScheduledFrame,
  type ScheduledFrame,
} from '../../../../shared/utils/frameScheduler';
import { ExtensionHandle } from '../../../../platform/rpc/webview-rpc-client';
import { collectSourceLineTargetEntries } from '../utils/sourceLineElements';
import type { SourceLineEntry } from '../utils/sourceLineElements';
import {
  cancelSourceLineScroll,
  getSourceLineScrollRetryDelayMs,
  isSourceLineScrollInProgress,
} from '../utils/scrollToSourceLine';

const log = createTaggedLogger(LogTags.RPC_WEBVIEW);
const PREVIEW_SCROLL_HYSTERESIS_PX = 24;
const PREVIEW_SOURCE_REPORT_INTERVAL_MS = 50;
const PREVIEW_SOURCE_REPORT_RETRY_MS = 120;
const PREVIEW_SOURCE_REPORT_IGNORED_RETRY_MS = 250;
const MIN_VISIBLE_HEIGHT_PX = 1;
const USER_SCROLL_INTERRUPT_KEYS = new Set([
  ' ',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'End',
  'Home',
  'PageDown',
  'PageUp',
]);

interface ActiveLineCandidate {
  line: number;
  distance: number;
  visibleTop: number;
}

interface UsePreviewScrollSyncOptions {
  containerRef: RefObject<HTMLElement | null>;
  trigger?: unknown;
  mode: PreviewScrollSyncValue;
}

function getCandidateDistance(rect: DOMRect, anchorY: number): number {
  if (rect.top <= anchorY && rect.bottom >= anchorY) {
    return 0;
  }

  return Math.min(
    Math.abs(rect.top - anchorY),
    Math.abs(rect.bottom - anchorY)
  );
}

function isBetterCandidate(
  candidate: ActiveLineCandidate,
  best: ActiveLineCandidate | undefined
): boolean {
  if (!best) {
    return true;
  }

  if (candidate.distance !== best.distance) {
    return candidate.distance < best.distance;
  }

  return candidate.visibleTop < best.visibleTop;
}

function isScrollInterruptKey(event: KeyboardEvent): boolean {
  return USER_SCROLL_INTERRUPT_KEYS.has(event.key);
}

function findActivePreviewSourceLineInEntries(
  entries: readonly SourceLineEntry[],
  viewportHeight = window.innerHeight,
  stickyLine?: number
): number | undefined {
  const anchorY = viewportHeight * SOURCE_LINE_SCROLL_SYNC_ANCHOR_RATIO;
  let best: ActiveLineCandidate | undefined;
  let sticky: ActiveLineCandidate | undefined;

  for (const { targetElement, sourceLine } of entries) {
    if (sourceLine === null) {
      continue;
    }

    const rect = targetElement.getBoundingClientRect();
    const visibleTop = Math.max(rect.top, 0);
    const visibleBottom = Math.min(rect.bottom, viewportHeight);
    if (visibleBottom - visibleTop < MIN_VISIBLE_HEIGHT_PX) {
      continue;
    }

    const candidate = {
      line: sourceLine,
      distance: getCandidateDistance(rect, anchorY),
      visibleTop,
    };
    if (sourceLine === stickyLine && isBetterCandidate(candidate, sticky)) {
      sticky = candidate;
    }
    if (isBetterCandidate(candidate, best)) {
      best = candidate;
    }
  }

  if (
    sticky &&
    best &&
    sticky.line !== best.line &&
    sticky.distance <= best.distance + PREVIEW_SCROLL_HYSTERESIS_PX
  ) {
    return sticky.line;
  }

  return best?.line;
}

export function findActivePreviewSourceLine(
  container: HTMLElement,
  viewportHeight = window.innerHeight,
  stickyLine?: number
): number | undefined {
  return findActivePreviewSourceLineInEntries(
    collectSourceLineTargetEntries(container),
    viewportHeight,
    stickyLine
  );
}

async function reportPreviewSourceLine(
  line: number
): Promise<PreviewSourceLineReportResult> {
  try {
    return await ExtensionHandle.reportPreviewSourceLine(line);
  } catch (error) {
    log.warn('Failed to report preview source line', error);
    return 'ignored';
  }
}

export function usePreviewScrollSync({
  containerRef,
  trigger,
  mode,
}: UsePreviewScrollSyncOptions): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isPreviewToEditorMode(mode)) {
      return;
    }

    let frame: ScheduledFrame | undefined;
    let reportTimer: ReturnType<typeof setTimeout> | undefined;
    let suppressedFlushTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    let hasSentReport = false;
    let lastAcceptedLine: number | undefined;
    let lastSentAtMs = 0;
    let pendingLine: number | undefined;
    let inFlightLine: number | undefined;
    let sourceLineEntries = collectSourceLineTargetEntries(container);
    let sourceLineEntriesDirty = false;

    const clearReportTimer = (): void => {
      if (reportTimer) {
        clearTimeout(reportTimer);
        reportTimer = undefined;
      }
    };

    const clearSuppressedFlushTimer = (): void => {
      if (suppressedFlushTimer) {
        clearTimeout(suppressedFlushTimer);
        suppressedFlushTimer = undefined;
      }
    };

    const getSourceLineEntries = (): readonly SourceLineEntry[] => {
      if (sourceLineEntriesDirty) {
        sourceLineEntries = collectSourceLineTargetEntries(container);
        sourceLineEntriesDirty = false;
      }

      return sourceLineEntries;
    };

    const getStickyLine = (): number | undefined =>
      pendingLine ?? inFlightLine ?? lastAcceptedLine;

    const scheduleReport = (minimumDelayMs?: number): void => {
      if (disposed || inFlightLine !== undefined || pendingLine === undefined) {
        return;
      }

      if (reportTimer) {
        return;
      }

      const intervalDelayMs = hasSentReport
        ? Math.max(
            0,
            PREVIEW_SOURCE_REPORT_INTERVAL_MS - (Date.now() - lastSentAtMs)
          )
        : 0;
      const delayMs = Math.max(intervalDelayMs, minimumDelayMs ?? 0);
      if (delayMs === 0) {
        sendPendingReport();
        return;
      }

      reportTimer = setTimeout(sendPendingReport, delayMs);
    };

    const queueLine = (line: number): void => {
      if (
        line === lastAcceptedLine &&
        pendingLine === undefined &&
        inFlightLine === undefined
      ) {
        return;
      }
      if (line === pendingLine || line === inFlightLine) {
        return;
      }

      pendingLine = line;
      scheduleReport();
    };

    const finishReport = (
      line: number,
      result: PreviewSourceLineReportResult
    ): void => {
      let retryDelayMs: number | undefined;
      const queueRetry = (delayMs: number): void => {
        if (pendingLine === undefined && line !== lastAcceptedLine) {
          pendingLine = line;
          retryDelayMs = delayMs;
        }
      };

      if (result === 'accepted') {
        lastAcceptedLine = line;
      } else if (result === 'retry') {
        // editor reveal is briefly suppressed
        queueRetry(PREVIEW_SOURCE_REPORT_RETRY_MS);
      } else {
        // ignored reports may be transient when the editor is hidden or RPC fails
        queueRetry(PREVIEW_SOURCE_REPORT_IGNORED_RETRY_MS);
      }

      inFlightLine = undefined;
      if (pendingLine !== undefined) {
        scheduleReport(retryDelayMs);
      }
    };

    function sendPendingReport(): void {
      clearReportTimer();
      if (disposed || inFlightLine !== undefined) {
        return;
      }

      const line = pendingLine;
      pendingLine = undefined;
      if (line === undefined || line === lastAcceptedLine) {
        return;
      }

      inFlightLine = line;
      hasSentReport = true;
      lastSentAtMs = Date.now();
      void reportPreviewSourceLine(line).then((result) => {
        if (!disposed) {
          finishReport(line, result);
        }
      });
    }

    const flush = (): void => {
      frame = undefined;
      if (disposed) {
        return;
      }

      if (isSourceLineScrollInProgress()) {
        scheduleSuppressedFlush();
        return;
      }

      const line = findActivePreviewSourceLineInEntries(
        getSourceLineEntries(),
        window.innerHeight,
        getStickyLine()
      );
      if (line === undefined) {
        return;
      }

      queueLine(line);
    };

    const schedule = (): void => {
      if (frame) {
        return;
      }

      frame = scheduleFrame(flush);
    };

    const scheduleSuppressedFlush = (): void => {
      if (disposed || suppressedFlushTimer) {
        return;
      }

      suppressedFlushTimer = setTimeout(() => {
        suppressedFlushTimer = undefined;
        schedule();
      }, getSourceLineScrollRetryDelayMs());
    };

    const handleUserScrollIntent = (): void => {
      if (!isSourceLineScrollInProgress()) {
        return;
      }

      cancelSourceLineScroll();
      clearSuppressedFlushTimer();
      schedule();
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (isScrollInterruptKey(event)) {
        handleUserScrollIntent();
      }
    };

    const markSourceLineEntriesDirty = (): void => {
      sourceLineEntriesDirty = true;
      schedule();
    };

    const mutationObserver =
      typeof MutationObserver === 'undefined'
        ? undefined
        : new MutationObserver(markSourceLineEntriesDirty);
    mutationObserver?.observe(container, {
      attributes: true,
      attributeFilter: [
        'aria-expanded',
        'data-source-line',
        'hidden',
        'open',
        'style',
      ],
      childList: true,
      subtree: true,
    });

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('wheel', handleUserScrollIntent, {
      passive: true,
    });
    window.addEventListener('touchmove', handleUserScrollIntent, {
      passive: true,
    });
    window.addEventListener('mousedown', handleUserScrollIntent, {
      passive: true,
    });
    window.addEventListener('keydown', handleKeyDown);
    schedule();

    return () => {
      disposed = true;
      mutationObserver?.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('wheel', handleUserScrollIntent);
      window.removeEventListener('touchmove', handleUserScrollIntent);
      window.removeEventListener('mousedown', handleUserScrollIntent);
      window.removeEventListener('keydown', handleKeyDown);
      clearReportTimer();
      clearSuppressedFlushTimer();
      if (frame) {
        cancelScheduledFrame(frame);
      }
    };
  }, [containerRef, mode, trigger]);
}
