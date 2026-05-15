// tests/extension/workspace-events.test.ts
// ensure workspace config handler wires preview updates for runtime setting keys

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import {
  mockConfigManager,
  mockPreviewManager,
} from '../helpers/mock-services';
import { initWorkspaceHandlers } from '../../packages/extension-host/src/app/workspace-events';
import { SETTINGS } from '../../packages/extension-host/src/shared/config';
import {
  disposeEditorPreviewScrollSync,
  handlePreviewSourceLineReport,
} from '../../packages/extension-host/src/features/preview/scroll-sync';

describe('workspace-events', () => {
  let visibleRangeCallback:
    | ((event: { textEditor: vscode.TextEditor }) => void)
    | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    visibleRangeCallback = undefined;

    (vscode.workspace as any).onDidSaveTextDocument = vi.fn(() => ({
      dispose: vi.fn(),
    }));
    (vscode.workspace as any).onDidChangeTextDocument = vi.fn(() => ({
      dispose: vi.fn(),
    }));
    (vscode.workspace as any).onDidChangeWorkspaceFolders = vi.fn(() => ({
      dispose: vi.fn(),
    }));
    (vscode.window as any).onDidChangeTextEditorVisibleRanges = vi.fn(
      (callback: (event: { textEditor: vscode.TextEditor }) => void) => {
        visibleRangeCallback = callback;
        return { dispose: vi.fn() };
      }
    );
    (vscode.window as any).activeTextEditor = undefined;
    (vscode.window as any).visibleTextEditors = [];
  });

  afterEach(() => {
    disposeEditorPreviewScrollSync();
    (vscode.window as any).activeTextEditor = undefined;
    (vscode.window as any).visibleTextEditors = [];
    vi.useRealTimers();
  });

  it('subscribes preview update handler to runtime config keys', () => {
    let changeCallback: (() => void) | undefined;
    mockConfigManager.onDidChangeKey.mockImplementation(
      (_keys: string[], callback: () => void) => {
        changeCallback = callback;
        return { dispose: vi.fn() };
      }
    );

    const updateConfiguration = vi.fn();
    mockPreviewManager.getCurrentPreview.mockReturnValue({
      updateConfiguration,
    });

    const context = { subscriptions: [] as Array<{ dispose: () => void }> };
    initWorkspaceHandlers(context as any);

    expect(mockConfigManager.onDidChangeKey).toHaveBeenCalledTimes(1);
    expect(mockConfigManager.onDidChangeKey).toHaveBeenCalledWith(
      expect.arrayContaining([
        SETTINGS.SOURCE_LINE_HIGHLIGHT,
        SETTINGS.SOURCE_LINE_HIGHLIGHT_COLOR,
        SETTINGS.SCROLL_SYNC,
        SETTINGS.SHIM_SIDE_RAIL,
      ]),
      expect.any(Function)
    );
    expect(context.subscriptions.length).toBe(5);

    changeCallback?.();
    expect(updateConfiguration).toHaveBeenCalledTimes(1);
  });

  it('live-syncs the preview to the focused editor line when enabled', () => {
    vi.useFakeTimers();
    const uri = vscode.Uri.file('/workspace/test.mdx');
    const scrollToLine = vi.fn();
    mockPreviewManager.getCurrentPreview.mockReturnValue({
      active: true,
      doc: { uri },
      configuration: { scrollSync: 'editorToPreview' },
      scrollToLine,
    });

    const context = { subscriptions: [] as Array<{ dispose: () => void }> };
    initWorkspaceHandlers(context as any);

    visibleRangeCallback?.({
      textEditor: {
        document: { uri },
        visibleRanges: [new vscode.Range(4, 0, 20, 0)],
      } as never,
    });

    expect(scrollToLine).toHaveBeenCalledTimes(1);
    expect(scrollToLine).toHaveBeenLastCalledWith(10);

    visibleRangeCallback?.({
      textEditor: {
        document: { uri },
        visibleRanges: [new vscode.Range(9, 0, 20, 0)],
      } as never,
    });
    vi.advanceTimersByTime(10);
    visibleRangeCallback?.({
      textEditor: {
        document: { uri },
        visibleRanges: [new vscode.Range(14, 0, 20, 0)],
      } as never,
    });

    vi.advanceTimersByTime(22);
    expect(scrollToLine).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);

    expect(scrollToLine).toHaveBeenCalledTimes(2);
    expect(scrollToLine).toHaveBeenLastCalledWith(17);
  });

  it('reveals editor lines from preview reports without feedback loops', () => {
    vi.useFakeTimers();
    const uri = vscode.Uri.file('/workspace/test.mdx');
    const scrollToLine = vi.fn();
    const revealRange = vi.fn();
    const preview = {
      active: true,
      doc: { uri },
      configuration: { scrollSync: 'bidirectional' },
      scrollToLine,
    };
    const editor = {
      document: { uri, lineCount: 200 },
      visibleRanges: [new vscode.Range(0, 0, 20, 0)],
      revealRange,
    };
    (vscode.window as any).visibleTextEditors = [editor];
    mockPreviewManager.getCurrentPreview.mockReturnValue(preview);

    const context = { subscriptions: [] as Array<{ dispose: () => void }> };
    initWorkspaceHandlers(context as any);

    visibleRangeCallback?.({
      textEditor: {
        document: { uri },
        visibleRanges: [new vscode.Range(4, 0, 20, 0)],
      } as never,
    });
    expect(scrollToLine).toHaveBeenCalledWith(10);

    expect(handlePreviewSourceLineReport(preview as never, 12)).toBe('retry');
    expect(revealRange).not.toHaveBeenCalled();

    vi.advanceTimersByTime(121);
    expect(handlePreviewSourceLineReport(preview as never, 12)).toBe(
      'accepted'
    );
    expect(revealRange).not.toHaveBeenCalled();

    expect(handlePreviewSourceLineReport(preview as never, 18)).toBe(
      'accepted'
    );

    // reveal anchors reported line at preview 35% ratio
    // visibleLineCount=21, anchorOffset=floor(20*0.35)=7, reportedIdx=17 -> top=10
    expect(revealRange).toHaveBeenCalledTimes(1);
    expect(revealRange.mock.calls[0][0].start.line).toBe(10);
    expect(revealRange.mock.calls[0][1]).toBe(
      vscode.TextEditorRevealType.AtTop
    );

    visibleRangeCallback?.({
      textEditor: {
        document: { uri },
        visibleRanges: [new vscode.Range(17, 0, 36, 0)],
      } as never,
    });
    expect(scrollToLine).toHaveBeenCalledTimes(1);

    expect(handlePreviewSourceLineReport(preview as never, 60)).toBe(
      'accepted'
    );

    // reported line outside viewport -> anchored top = 59 - 7 = 52
    expect(revealRange).toHaveBeenCalledTimes(2);
    expect(revealRange.mock.calls[1][0].start.line).toBe(52);
    expect(revealRange.mock.calls[1][1]).toBe(
      vscode.TextEditorRevealType.AtTop
    );
  });

  it('does not sync editor scroll when mode excludes editor-to-preview', () => {
    vi.useFakeTimers();
    const uri = vscode.Uri.file('/workspace/test.mdx');
    const scrollToLine = vi.fn();
    mockPreviewManager.getCurrentPreview.mockReturnValue({
      active: true,
      doc: { uri },
      configuration: { scrollSync: 'previewToEditor' },
      scrollToLine,
    });

    const context = { subscriptions: [] as Array<{ dispose: () => void }> };
    initWorkspaceHandlers(context as any);

    visibleRangeCallback?.({
      textEditor: {
        document: { uri },
        visibleRanges: [new vscode.Range(4, 0, 20, 0)],
      } as never,
    });

    vi.advanceTimersByTime(80);

    expect(scrollToLine).not.toHaveBeenCalled();
  });

  it('ignores visible-range events for editors not bound to the preview', () => {
    vi.useFakeTimers();
    const previewUri = vscode.Uri.file('/workspace/preview.mdx');
    const otherUri = vscode.Uri.file('/workspace/other.mdx');
    const scrollToLine = vi.fn();
    mockPreviewManager.getCurrentPreview.mockReturnValue({
      active: true,
      doc: { uri: previewUri },
      configuration: { scrollSync: 'editorToPreview' },
      scrollToLine,
    });

    const context = { subscriptions: [] as Array<{ dispose: () => void }> };
    initWorkspaceHandlers(context as any);

    // scrolling an unrelated editor must not dispatch to the preview
    visibleRangeCallback?.({
      textEditor: {
        document: { uri: otherUri },
        visibleRanges: [new vscode.Range(4, 0, 20, 0)],
      } as never,
    });
    vi.advanceTimersByTime(80);
    expect(scrollToLine).not.toHaveBeenCalled();

    // returning focus to the preview's source resumes sync
    visibleRangeCallback?.({
      textEditor: {
        document: { uri: previewUri },
        visibleRanges: [new vscode.Range(4, 0, 20, 0)],
      } as never,
    });
    expect(scrollToLine).toHaveBeenCalledTimes(1);
    expect(scrollToLine).toHaveBeenLastCalledWith(10);
  });
});
