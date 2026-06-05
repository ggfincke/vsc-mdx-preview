// packages/extension-host/src/features/preview/scroll-sync.ts
// bidirectional source-line scroll synchronization helpers

import * as vscode from 'vscode';
import {
  isEditorToPreviewMode,
  isPreviewToEditorMode,
  SOURCE_LINE_SCROLL_SYNC_ANIMATION_MS,
  SOURCE_LINE_SCROLL_SYNC_ANCHOR_RATIO,
  SOURCE_LINE_SCROLL_SYNC_SETTLE_MS,
  type PreviewSourceLineReportResult,
  type PreviewScrollSyncValue,
} from '@mdx-preview/contracts';
import { getPreviewManager } from '../../app/services';
import type { Preview } from './Preview';

const EDITOR_TO_PREVIEW_SCROLL_INTERVAL_MS = 33;

type SyncDirection = 'editorToPreview' | 'previewToEditor';

interface PreviewScheduler {
  pendingLine: number | undefined;
  pendingDocumentKey: string | undefined;
  lastPreviewSourceKey: string | undefined;
  lastEditorToPreviewDispatchKey: string | undefined;
  lastPreviewToEditorReportKey: string | undefined;
  lastDispatchAtMs: number;
  ignoreEditorUntilMs: number;
  ignorePreviewUntilMs: number;
  liveTimer: ReturnType<typeof setTimeout> | undefined;
  settleTimer: ReturnType<typeof setTimeout> | undefined;
}

// strong refs; Preview.dispose must call disposeScrollSyncForPreview
const schedulers = new Map<Preview, PreviewScheduler>();

function modeSupports(
  mode: PreviewScrollSyncValue,
  direction: SyncDirection
): boolean {
  return direction === 'editorToPreview'
    ? isEditorToPreviewMode(mode)
    : isPreviewToEditorMode(mode);
}

function isEligibleForSync(
  preview: Preview | undefined,
  direction: SyncDirection
): preview is Preview {
  return (
    !!preview &&
    preview.active &&
    modeSupports(preview.configuration.scrollSync, direction)
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

// pick the topmost visible range; w/ folded code vscode reports several ranges
// & the anchor math intentionally tracks only this leading one
function getLeadingVisibleRange(
  visibleRanges: readonly vscode.Range[]
): vscode.Range | undefined {
  if (visibleRanges.length === 0) {
    return undefined;
  }

  let leadingRange: vscode.Range | undefined;
  for (const range of visibleRanges) {
    if (!leadingRange || range.start.line < leadingRange.start.line) {
      leadingRange = range;
    }
  }

  return leadingRange;
}

function getAnchoredVisibleSourceLine(
  visibleRanges: readonly vscode.Range[]
): number | undefined {
  const range = getLeadingVisibleRange(visibleRanges);
  if (!range) {
    return undefined;
  }

  const visibleLineCount = Math.max(1, range.end.line - range.start.line + 1);
  const anchorOffset = Math.floor(
    (visibleLineCount - 1) * SOURCE_LINE_SCROLL_SYNC_ANCHOR_RATIO
  );

  // visible ranges are 0-based; mdx source-line annotations are 1-based
  return range.start.line + anchorOffset + 1;
}

function getEditorScrollLine(
  preview: Preview,
  editor: vscode.TextEditor | undefined
): number | undefined {
  if (!editor || !isPreviewDocument(preview, editor.document)) {
    return undefined;
  }
  return getAnchoredVisibleSourceLine(editor.visibleRanges);
}

// build a scheduler in its zero state (all keys cleared)
function makeScheduler(): PreviewScheduler {
  return {
    pendingLine: undefined,
    pendingDocumentKey: undefined,
    lastPreviewSourceKey: undefined,
    lastEditorToPreviewDispatchKey: undefined,
    lastPreviewToEditorReportKey: undefined,
    lastDispatchAtMs: 0,
    ignoreEditorUntilMs: 0,
    ignorePreviewUntilMs: 0,
    liveTimer: undefined,
    settleTimer: undefined,
  };
}

function getOrCreateScheduler(preview: Preview): PreviewScheduler {
  const existing = schedulers.get(preview);
  if (existing) {
    return existing;
  }
  const created = makeScheduler();
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

// clear both pending dispatch timers on a scheduler
function clearSchedulerTimers(scheduler: PreviewScheduler): void {
  scheduler.liveTimer = clearSchedulerTimer(scheduler.liveTimer);
  scheduler.settleTimer = clearSchedulerTimer(scheduler.settleTimer);
}

function clearPendingEditorToPreviewScroll(scheduler: PreviewScheduler): void {
  scheduler.pendingLine = undefined;
  scheduler.pendingDocumentKey = undefined;
  scheduler.liveTimer = clearSchedulerTimer(scheduler.liveTimer);
  scheduler.settleTimer = clearSchedulerTimer(scheduler.settleTimer);
  scheduler.lastEditorToPreviewDispatchKey = undefined;
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
    !isEligibleForSync(preview, 'editorToPreview') ||
    getPreviewDocumentKey(preview) !== documentKey
  ) {
    return;
  }

  const dispatchKey = getDispatchKey(documentKey, line);
  if (scheduler.lastPreviewSourceKey === dispatchKey) {
    return;
  }

  scheduler.lastPreviewSourceKey = dispatchKey;
  scheduler.lastEditorToPreviewDispatchKey = dispatchKey;
  scheduler.lastDispatchAtMs = Date.now();
  scheduler.ignorePreviewUntilMs =
    scheduler.lastDispatchAtMs + SOURCE_LINE_SCROLL_SYNC_ANIMATION_MS;
  preview.scrollToLine(line);
}

function scheduleLiveDispatch(preview: Preview): void {
  const scheduler = getOrCreateScheduler(preview);
  const elapsedMs = Date.now() - scheduler.lastDispatchAtMs;
  if (
    scheduler.lastEditorToPreviewDispatchKey === undefined ||
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
    SOURCE_LINE_SCROLL_SYNC_SETTLE_MS
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
    scheduler.lastPreviewSourceKey === dispatchKey
  ) {
    // skip duplicate settled dispatch when preview is already on this line
    return;
  }

  scheduler.pendingLine = line;
  scheduler.pendingDocumentKey = documentKey;
  scheduleLiveDispatch(preview);
  scheduleSettleDispatch(preview);
}

function shouldIgnoreScroll(
  preview: Preview,
  direction: SyncDirection
): boolean {
  const scheduler = schedulers.get(preview);
  if (!scheduler) {
    return false;
  }
  const until =
    direction === 'editorToPreview'
      ? scheduler.ignoreEditorUntilMs
      : scheduler.ignorePreviewUntilMs;
  return until > Date.now();
}

function findVisiblePreviewEditor(
  preview: Preview
): vscode.TextEditor | undefined {
  const documentKey = getPreviewDocumentKey(preview);
  const visibleEditor = vscode.window.visibleTextEditors.find(
    (editor) => editor.document.uri.toString() === documentKey
  );
  if (visibleEditor) {
    return visibleEditor;
  }

  const activeEditor = vscode.window.activeTextEditor;
  return activeEditor?.document.uri.toString() === documentKey
    ? activeEditor
    : undefined;
}

function getClampedLineIndex(
  editor: vscode.TextEditor,
  sourceLine: number
): number {
  const lineCount = Math.max(1, editor.document.lineCount);
  return Math.max(0, Math.min(sourceLine - 1, lineCount - 1));
}

function getEditorVisibleLineCount(editor: vscode.TextEditor): number {
  const leading = getLeadingVisibleRange(editor.visibleRanges);
  if (!leading) {
    return 1;
  }
  return Math.max(1, leading.end.line - leading.start.line + 1);
}

// reveal at the shared 35% anchor so preview->editor keeps the user's delta
// instead of snapping to vscode's ~50% InCenter position
function computeAnchoredTopLine(
  editor: vscode.TextEditor,
  lineIndex: number
): number {
  const visibleLineCount = getEditorVisibleLineCount(editor);
  const anchorOffset = Math.floor(
    (visibleLineCount - 1) * SOURCE_LINE_SCROLL_SYNC_ANCHOR_RATIO
  );
  const maxTopLine = Math.max(0, editor.document.lineCount - 1);
  return Math.max(0, Math.min(maxTopLine, lineIndex - anchorOffset));
}

function revealEditorSourceLine(
  editor: vscode.TextEditor,
  sourceLine: number
): boolean {
  const lineIndex = getClampedLineIndex(editor, sourceLine);
  const topLine = computeAnchoredTopLine(editor, lineIndex);
  if (getLeadingVisibleRange(editor.visibleRanges)?.start.line === topLine) {
    return false;
  }

  const position = new vscode.Position(topLine, 0);
  const range = new vscode.Range(position, position);
  editor.revealRange(range, vscode.TextEditorRevealType.AtTop);
  return true;
}

export function supportsEditorToPreviewScrollSync(
  mode: PreviewScrollSyncValue
): boolean {
  return isEditorToPreviewMode(mode);
}

export function handleEditorVisibleRangesChange(
  event: vscode.TextEditorVisibleRangesChangeEvent
): void {
  const preview = getPreviewManager().getCurrentPreview();
  if (
    !isEligibleForSync(preview, 'editorToPreview') ||
    shouldIgnoreScroll(preview, 'editorToPreview')
  ) {
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
  if (!isEligibleForSync(preview, 'editorToPreview')) {
    return;
  }
  const line = getEditorScrollLine(preview, findVisiblePreviewEditor(preview));
  if (line === undefined) {
    return;
  }
  queueScroll(preview, line);
}

export function handlePreviewSourceLineReport(
  preview: Preview | undefined,
  line: number
): PreviewSourceLineReportResult {
  if (!Number.isInteger(line) || line < 1) {
    return 'ignored';
  }
  if (!isEligibleForSync(preview, 'previewToEditor')) {
    return 'ignored';
  }
  const scheduler = getOrCreateScheduler(preview);
  if (shouldIgnoreScroll(preview, 'previewToEditor')) {
    clearPendingEditorToPreviewScroll(scheduler);
    return 'retry';
  }

  const documentKey = getPreviewDocumentKey(preview);
  const dispatchKey = getDispatchKey(documentKey, line);
  if (scheduler.lastPreviewToEditorReportKey === dispatchKey) {
    scheduler.lastPreviewSourceKey = dispatchKey;
    clearPendingEditorToPreviewScroll(scheduler);
    return 'accepted';
  }

  const editor = findVisiblePreviewEditor(preview);
  if (!editor) {
    return 'ignored';
  }

  clearPendingEditorToPreviewScroll(scheduler);
  const didReveal = revealEditorSourceLine(editor, line);
  scheduler.lastPreviewToEditorReportKey = dispatchKey;
  scheduler.lastPreviewSourceKey = dispatchKey;
  if (didReveal) {
    scheduler.ignoreEditorUntilMs =
      Date.now() + SOURCE_LINE_SCROLL_SYNC_ANIMATION_MS;
  }
  return 'accepted';
}

// suppress editor->preview sync after extension-driven editor movement
// prevents visible-range changes from bouncing back into the preview
export function suppressEditorScrollSync(preview: Preview): void {
  const scheduler = getOrCreateScheduler(preview);
  scheduler.ignoreEditorUntilMs =
    Date.now() + SOURCE_LINE_SCROLL_SYNC_ANIMATION_MS;
}

// reset cached dispatch state after webview reload
// allow the same line to dispatch after webview replacement
export function resetPreviewScrollSync(preview: Preview): void {
  const scheduler = schedulers.get(preview);
  if (!scheduler) {
    return;
  }
  clearSchedulerTimers(scheduler);
  Object.assign(scheduler, makeScheduler());
}

export function disposeScrollSyncForPreview(preview: Preview): void {
  const scheduler = schedulers.get(preview);
  if (!scheduler) {
    return;
  }
  clearSchedulerTimers(scheduler);
  schedulers.delete(preview);
}

export function disposeEditorPreviewScrollSync(): void {
  for (const scheduler of schedulers.values()) {
    clearSchedulerTimers(scheduler);
  }
  schedulers.clear();
}
