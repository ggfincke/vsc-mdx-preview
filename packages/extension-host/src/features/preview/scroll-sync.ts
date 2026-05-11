// packages/extension-host/src/features/preview/scroll-sync.ts
// editor-to-preview scroll synchronization helpers

import * as vscode from 'vscode';
import debounce from 'lodash.debounce';
import { getPreviewManager } from '../../app/services';
import type { Preview } from './Preview';

const EDITOR_TO_PREVIEW_SCROLL_DEBOUNCE_MS = 80;

interface PreviewScheduler {
  pendingLine: number | undefined;
  lastDispatchedLine: number | undefined;
  flush: (() => void) & { cancel(): void; flush(): void };
}

const schedulers = new Map<Preview, PreviewScheduler>();

function isEligibleForSync(
  preview: Preview | undefined
): preview is Preview {
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
  return preview.doc.uri.toString() === document.uri.toString();
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
    lastDispatchedLine: undefined,
    flush: debounce(
      () => flushScheduler(preview),
      EDITOR_TO_PREVIEW_SCROLL_DEBOUNCE_MS
    ),
  };
  schedulers.set(preview, created);
  return created;
}

function flushScheduler(preview: Preview): void {
  const scheduler = schedulers.get(preview);
  if (!scheduler) {
    return;
  }
  const line = scheduler.pendingLine;
  scheduler.pendingLine = undefined;
  if (line === undefined || !isEligibleForSync(preview)) {
    return;
  }
  scheduler.lastDispatchedLine = line;
  preview.scrollToLine(line);
}

function queueScroll(preview: Preview, line: number): void {
  const scheduler = getOrCreateScheduler(preview);
  if (
    scheduler.pendingLine === line ||
    (scheduler.pendingLine === undefined &&
      scheduler.lastDispatchedLine === line)
  ) {
    return;
  }
  scheduler.pendingLine = line;
  scheduler.flush();
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

// drop cached dispatch state for a preview — call when the webview reloads
// so a fresh scroll dispatches even if it matches the previously sent line
export function resetPreviewScrollSync(preview: Preview): void {
  const scheduler = schedulers.get(preview);
  if (!scheduler) {
    return;
  }
  scheduler.flush.cancel();
  scheduler.pendingLine = undefined;
  scheduler.lastDispatchedLine = undefined;
}

export function disposeEditorPreviewScrollSync(): void {
  for (const scheduler of schedulers.values()) {
    scheduler.flush.cancel();
  }
  schedulers.clear();
}
