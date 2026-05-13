// packages/extension-host/src/features/preview/scroll-sync.ts
// editor-to-preview scroll synchronization helpers

import * as vscode from 'vscode';
import { getPreviewManager } from '../../app/services';
import type { Preview } from './Preview';

const EDITOR_TO_PREVIEW_SCROLL_INTERVAL_MS = 33;
const EDITOR_TO_PREVIEW_SCROLL_SETTLE_MS = 80;

interface PreviewScheduler {
  pendingLine: number | undefined;
  pendingDocumentKey: string | undefined;
  lastDispatchedKey: string | undefined;
  lastDispatchAtMs: number;
  liveTimer: ReturnType<typeof setTimeout> | undefined;
  settleTimer: ReturnType<typeof setTimeout> | undefined;
}

const schedulers = new Map<Preview, PreviewScheduler>();

function isEligibleForSync(preview: Preview | undefined): preview is Preview {
  return (
    !!preview &&
    preview.active &&
    preview.configuration.scrollSync === 'editorToPreview'
  );
}

function isPreviewDocument(
  preview: Preview,
  document: vscode.TextDocument
): boolean {
  return getPreviewDocumentKey(preview) === document.uri.toString();
}

function getPreviewDocumentKey(preview: Preview): string {
  return preview.doc.uri.toString();
}

function getDispatchKey(documentKey: string, line: number): string {
  return `${documentKey}:${line}`;
}

function getFirstVisibleSourceLine(
  visibleRanges: readonly vscode.Range[]
): number | undefined {
  if (visibleRanges.length === 0) {
    return undefined;
  }

  let firstLine = Number.POSITIVE_INFINITY;
  for (const range of visibleRanges) {
    firstLine = Math.min(firstLine, range.start.line);
  }

  if (!Number.isFinite(firstLine)) {
    return undefined;
  }

  // visible ranges are 0-based; mdx source-line annotations are 1-based
  return firstLine + 1;
}

function getEditorScrollLine(
  preview: Preview,
  editor: vscode.TextEditor | undefined
): number | undefined {
  if (!editor || !isPreviewDocument(preview, editor.document)) {
    return undefined;
  }
  return getFirstVisibleSourceLine(editor.visibleRanges);
}

function getOrCreateScheduler(preview: Preview): PreviewScheduler {
  const existing = schedulers.get(preview);
  if (existing) {
    return existing;
  }
  const created: PreviewScheduler = {
    pendingLine: undefined,
    pendingDocumentKey: undefined,
    lastDispatchedKey: undefined,
    lastDispatchAtMs: 0,
    liveTimer: undefined,
    settleTimer: undefined,
  };
  schedulers.set(preview, created);
  return created;
}

function clearSchedulerTimer(
  timer: ReturnType<typeof setTimeout> | undefined
): undefined {
  if (timer) {
    clearTimeout(timer);
  }
  return undefined;
}

function dispatchPendingScroll(preview: Preview): void {
  const scheduler = schedulers.get(preview);
  if (!scheduler) {
    return;
  }
  const line = scheduler.pendingLine;
  const documentKey = scheduler.pendingDocumentKey;
  scheduler.pendingLine = undefined;
  scheduler.pendingDocumentKey = undefined;
  scheduler.liveTimer = clearSchedulerTimer(scheduler.liveTimer);

  if (
    line === undefined ||
    documentKey === undefined ||
    !isEligibleForSync(preview) ||
    getPreviewDocumentKey(preview) !== documentKey
  ) {
    return;
  }

  const dispatchKey = getDispatchKey(documentKey, line);
  if (scheduler.lastDispatchedKey === dispatchKey) {
    return;
  }

  scheduler.lastDispatchedKey = dispatchKey;
  scheduler.lastDispatchAtMs = Date.now();
  preview.scrollToLine(line);
}

function scheduleLiveDispatch(preview: Preview): void {
  const scheduler = getOrCreateScheduler(preview);
  const elapsedMs = Date.now() - scheduler.lastDispatchAtMs;
  if (
    scheduler.lastDispatchedKey === undefined ||
    elapsedMs >= EDITOR_TO_PREVIEW_SCROLL_INTERVAL_MS
  ) {
    dispatchPendingScroll(preview);
    return;
  }

  if (!scheduler.liveTimer) {
    scheduler.liveTimer = setTimeout(
      () => dispatchPendingScroll(preview),
      EDITOR_TO_PREVIEW_SCROLL_INTERVAL_MS - elapsedMs
    );
  }
}

function scheduleSettleDispatch(preview: Preview): void {
  const scheduler = getOrCreateScheduler(preview);
  scheduler.settleTimer = clearSchedulerTimer(scheduler.settleTimer);
  scheduler.settleTimer = setTimeout(
    () => dispatchPendingScroll(preview),
    EDITOR_TO_PREVIEW_SCROLL_SETTLE_MS
  );
}

function queueScroll(preview: Preview, line: number): void {
  const scheduler = getOrCreateScheduler(preview);
  const documentKey = getPreviewDocumentKey(preview);
  const dispatchKey = getDispatchKey(documentKey, line);
  if (
    scheduler.pendingLine === line &&
    scheduler.pendingDocumentKey === documentKey
  ) {
    scheduleSettleDispatch(preview);
    return;
  }
  if (
    scheduler.pendingLine === undefined &&
    scheduler.lastDispatchedKey === dispatchKey
  ) {
    scheduleSettleDispatch(preview);
    return;
  }

  scheduler.pendingLine = line;
  scheduler.pendingDocumentKey = documentKey;
  scheduleLiveDispatch(preview);
  scheduleSettleDispatch(preview);
}

export function handleEditorVisibleRangesChange(
  event: vscode.TextEditorVisibleRangesChangeEvent
): void {
  const preview = getPreviewManager().getCurrentPreview();
  if (!isEligibleForSync(preview)) {
    return;
  }
  const line = getEditorScrollLine(preview, event.textEditor);
  if (line === undefined) {
    return;
  }
  queueScroll(preview, line);
}

export function syncPreviewScrollFromActiveEditor(
  preview: Preview | undefined = getPreviewManager().getCurrentPreview()
): void {
  if (!isEligibleForSync(preview)) {
    return;
  }
  const line = getEditorScrollLine(preview, vscode.window.activeTextEditor);
  if (line === undefined) {
    return;
  }
  queueScroll(preview, line);
}

// reset cached dispatch state after webview reload
// allow the same line to dispatch after webview replacement
export function resetPreviewScrollSync(preview: Preview): void {
  const scheduler = schedulers.get(preview);
  if (!scheduler) {
    return;
  }
  scheduler.liveTimer = clearSchedulerTimer(scheduler.liveTimer);
  scheduler.settleTimer = clearSchedulerTimer(scheduler.settleTimer);
  scheduler.pendingLine = undefined;
  scheduler.pendingDocumentKey = undefined;
  scheduler.lastDispatchedKey = undefined;
  scheduler.lastDispatchAtMs = 0;
}

export function disposeEditorPreviewScrollSync(): void {
  for (const scheduler of schedulers.values()) {
    scheduler.liveTimer = clearSchedulerTimer(scheduler.liveTimer);
    scheduler.settleTimer = clearSchedulerTimer(scheduler.settleTimer);
  }
  schedulers.clear();
}
