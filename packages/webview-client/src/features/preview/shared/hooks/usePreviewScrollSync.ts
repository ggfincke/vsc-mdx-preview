// packages/webview-client/src/features/preview/shared/hooks/usePreviewScrollSync.ts
// report active preview source lines for preview-to-editor scroll sync

import { useEffect, type RefObject } from 'react';
import {
  isPreviewToEditorMode,
  LogTags,
  type PreviewScrollSyncValue,
} from '@mdx-preview/contracts';
import { createTaggedLogger } from '../../../../shared/utils/createTaggedLogger';
import {
  scheduleFrame,
  cancelScheduledFrame,
  type ScheduledFrame,
} from '../../../../shared/utils/frameScheduler';
import { ExtensionHandle } from '../../../../platform/rpc/webview-rpc-client';
import { collectSourceLineEntries } from '../utils/sourceLineElements';

const log = createTaggedLogger(LogTags.RPC_WEBVIEW);
const PREVIEW_SCROLL_ANCHOR_RATIO = 0.35;
const MIN_VISIBLE_HEIGHT_PX = 1;

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

export function findActivePreviewSourceLine(
  container: HTMLElement,
  viewportHeight = window.innerHeight
): number | undefined {
  const anchorY = viewportHeight * PREVIEW_SCROLL_ANCHOR_RATIO;
  let best: ActiveLineCandidate | undefined;

  for (const { highlightElement, sourceLine } of collectSourceLineEntries(
    container
  )) {
    if (sourceLine === null) {
      continue;
    }

    const rect = highlightElement.getBoundingClientRect();
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
    if (isBetterCandidate(candidate, best)) {
      best = candidate;
      // exact anchor hit; later candidates with equal distance can only
      // tie-break worse on visibleTop
      if (best.distance === 0 && best.visibleTop === 0) {
        break;
      }
    }
  }

  return best?.line;
}

function reportPreviewSourceLine(line: number): void {
  try {
    void ExtensionHandle.reportPreviewSourceLine(line).catch((error) => {
      log.warn('Failed to report preview source line', error);
    });
  } catch (error) {
    log.warn('Failed to report preview source line', error);
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
    let disposed = false;
    let lastReportedLine: number | undefined;

    const flush = (): void => {
      frame = undefined;
      if (disposed) {
        return;
      }

      const line = findActivePreviewSourceLine(container);
      if (line === undefined || line === lastReportedLine) {
        return;
      }

      lastReportedLine = line;
      reportPreviewSourceLine(line);
    };

    const schedule = (): void => {
      if (frame) {
        return;
      }

      frame = scheduleFrame(flush);
    };

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    schedule();

    return () => {
      disposed = true;
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) {
        cancelScheduledFrame(frame);
      }
    };
  }, [containerRef, mode, trigger]);
}
