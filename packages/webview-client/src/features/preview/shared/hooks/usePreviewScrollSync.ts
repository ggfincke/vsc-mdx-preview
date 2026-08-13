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
const PREVIEW_SOURCE_REPORT_IGNORED_MAX_RETRY_MS = 2_000;
const PREVIEW_SOURCE_REPORT_IGNORED_MAX_RETRIES = 4;
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
    let ignoredLine: number | undefined;
    let ignoredRetryCount = 0;
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

    const rearmIgnoredReports = (): void => {
      ignoredLine = undefined;
      ignoredRetryCount = 0;
    };

    const rearmIgnoredReportsFromEnvironment = (): void => {
      const hasPendingIgnoredBackoff =
        reportTimer !== undefined && pendingLine === ignoredLine;
      rearmIgnoredReports();
      if (hasPendingIgnoredBackoff) {
        clearReportTimer();
      }
    };

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
      if (line === ignoredLine) {
        if (ignoredRetryCount >= PREVIEW_SOURCE_REPORT_IGNORED_MAX_RETRIES) {
          return;
        }
      } else {
        rearmIgnoredReports();
      }

      if (
        line === lastAcceptedLine &&
        pendingLine === undefined &&
        inFlightLine === undefined
      ) {
        return;
      }
      if (line === pendingLine) {
        scheduleReport();
        return;
      }
      if (line === inFlightLine) {
        if (pendingLine !== undefined) {
          pendingLine = undefined;
          clearReportTimer();
        }
        return;
      }

      const replacesPendingLine = pendingLine !== undefined;
      pendingLine = line;
      if (replacesPendingLine) {
        clearReportTimer();
      }
      scheduleReport();
    };

    const finishReport = (
      line: number,
      result: PreviewSourceLineReportResult
    ): void => {
      let retryDelayMs: number | undefined;
      const ownsPendingWork = pendingLine === undefined || pendingLine === line;
      const queueRetry = (delayMs: number): void => {
        if (pendingLine === undefined && line !== lastAcceptedLine) {
          pendingLine = line;
          retryDelayMs = delayMs;
        }
      };

      if (result === 'accepted') {
        lastAcceptedLine = line;
      }

      if (ownsPendingWork && result === 'accepted') {
        rearmIgnoredReports();
      } else if (ownsPendingWork && result === 'retry') {
        // editor reveal is briefly suppressed
        rearmIgnoredReports();
        queueRetry(PREVIEW_SOURCE_REPORT_RETRY_MS);
      } else if (ownsPendingWork && result === 'ignored') {
        ignoredLine = line;
        if (ignoredRetryCount < PREVIEW_SOURCE_REPORT_IGNORED_MAX_RETRIES) {
          const retryDelayMs = Math.min(
            PREVIEW_SOURCE_REPORT_IGNORED_RETRY_MS * 2 ** ignoredRetryCount,
            PREVIEW_SOURCE_REPORT_IGNORED_MAX_RETRY_MS
          );
          ignoredRetryCount += 1;
          queueRetry(retryDelayMs);
        }
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

    const scheduleFromEnvironment = (): void => {
      rearmIgnoredReportsFromEnvironment();
      schedule();
    };

    const handleVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') {
        scheduleFromEnvironment();
      }
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

    const handleSourceLineMutations: MutationCallback = (records) => {
      const hasEntryMutation = records.some(
        (record) =>
          record.type !== 'attributes' || record.attributeName !== 'style'
      );
      if (hasEntryMutation) {
        sourceLineEntriesDirty = true;
        rearmIgnoredReportsFromEnvironment();
      }
      schedule();
    };

    const mutationObserver =
      typeof MutationObserver === 'undefined'
        ? undefined
        : new MutationObserver(handleSourceLineMutations);
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

    window.addEventListener('scroll', scheduleFromEnvironment, {
      passive: true,
    });
    window.addEventListener('resize', scheduleFromEnvironment);
    window.addEventListener('focus', scheduleFromEnvironment);
    document.addEventListener('visibilitychange', handleVisibilityChange);
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
      window.removeEventListener('scroll', scheduleFromEnvironment);
      window.removeEventListener('resize', scheduleFromEnvironment);
      window.removeEventListener('focus', scheduleFromEnvironment);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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
