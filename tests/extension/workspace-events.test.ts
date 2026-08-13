// tests/extension/workspace-events.test.ts
// ensure workspace config handler wires preview updates for runtime setting keys

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import {
  mockConfigManager,
  mockFrameworkDetector,
  mockPreviewManager,
} from '../helpers/mock-services';
import { initWorkspaceHandlers } from '../../packages/extension-host/src/app/workspace-events';
import {
  PREVIEW_SETTING_ACTIONS,
  SETTINGS,
} from '../../packages/extension-host/src/shared/config';
import {
  disposeEditorPreviewScrollSync,
  handlePreviewSourceLineReport,
  resetPreviewScrollSync,
  syncPreviewScrollFromActiveEditor,
} from '../../packages/extension-host/src/features/preview/scroll-sync';
import type { FrameworkChangeEvent } from '../../packages/extension-host/src/features/framework/types';

const { mockWorkspaceLog } = vi.hoisted(() => ({
  mockWorkspaceLog: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../packages/extension-host/src/shared/logging/logger', () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  createTaggedLogger: vi.fn(() => mockWorkspaceLog),
}));

describe('workspace-events', () => {
  let saveCallback: ((event: { uri: vscode.Uri }) => void) | undefined;
  let documentChangeCallback:
    ((event: { document: vscode.TextDocument }) => void) | undefined;
  let visibleRangeCallback:
    ((event: { textEditor: vscode.TextEditor }) => void) | undefined;
  let frameworkChangeCallback:
    ((event: FrameworkChangeEvent) => void) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    saveCallback = undefined;
    documentChangeCallback = undefined;
    visibleRangeCallback = undefined;
    frameworkChangeCallback = undefined;
    mockFrameworkDetector.subscribe.mockImplementation((callback) => {
      frameworkChangeCallback = callback;
      return { dispose: vi.fn() };
    });

    (vscode.workspace as any).onDidSaveTextDocument = vi.fn(
      (callback: (event: { uri: vscode.Uri }) => void) => {
        saveCallback = callback;
        return { dispose: vi.fn() };
      }
    );
    (vscode.workspace as any).onDidChangeTextDocument = vi.fn(
      (callback: (event: { document: vscode.TextDocument }) => void) => {
        documentChangeCallback = callback;
        return { dispose: vi.fn() };
      }
    );
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

  it('dispatches preview document & setting events safely', async () => {
    let changeCallback: ((affectedKeys: string[]) => void) | undefined;
    mockConfigManager.onDidChangeConfiguration.mockImplementation(
      (callback: (affectedKeys: string[]) => void) => {
        changeCallback = callback;
        return { dispose: vi.fn() };
      }
    );

    const saveError = new Error('save failed');
    const changeError = new Error('change failed');
    const handleDidSaveTextDocument = vi.fn().mockRejectedValue(saveError);
    const handleDidChangeTextDocument = vi.fn().mockRejectedValue(changeError);
    const updateConfiguration = vi.fn();
    const updateWebview = vi.fn().mockResolvedValue(undefined);
    const previewUri = vscode.Uri.file('/workspace-a-copy/test.mdx');
    mockPreviewManager.getCurrentPreview.mockReturnValue({
      doc: { uri: previewUri },
      handleDidSaveTextDocument,
      handleDidChangeTextDocument,
      updateConfiguration,
      updateWebview,
    });

    const context = { subscriptions: [] as Array<{ dispose: () => void }> };
    initWorkspaceHandlers(context as any);

    const uri = previewUri;
    saveCallback?.({ uri });
    documentChangeCallback?.({
      document: { uri } as vscode.TextDocument,
    });
    await Promise.resolve();

    expect(handleDidSaveTextDocument).toHaveBeenCalledWith(uri.fsPath);
    expect(handleDidChangeTextDocument).toHaveBeenCalledWith(
      uri.fsPath,
      expect.objectContaining({ uri })
    );
    expect(mockWorkspaceLog.error).toHaveBeenCalledWith(
      'Error handling document save',
      saveError
    );
    expect(mockWorkspaceLog.error).toHaveBeenCalledWith(
      'Error handling document change',
      changeError
    );

    expect(mockConfigManager.onDidChangeConfiguration).toHaveBeenCalledTimes(1);
    expect(PREVIEW_SETTING_ACTIONS[SETTINGS.USE_SUCRASE]).toBe('recompile');
    expect(context.subscriptions.length).toBe(6);

    // runtime-push key: config update only, no forced recompile
    changeCallback?.([SETTINGS.PREVIEW_THEME]);
    expect(updateConfiguration).toHaveBeenCalledTimes(1);
    expect(updateWebview).not.toHaveBeenCalled();

    // recompile key: config update + forced webview update
    changeCallback?.([SETTINGS.USE_SUCRASE]);
    expect(updateConfiguration).toHaveBeenCalledTimes(2);
    expect(updateWebview).toHaveBeenCalledWith(true);

    // link behavior has one owner & pushes trust state without compilation
    changeCallback?.([SETTINGS.OPEN_MDX_LINKS_IN_PREVIEW]);
    expect(updateConfiguration).toHaveBeenCalledTimes(2);
    expect(updateWebview).toHaveBeenCalledTimes(1);

    // framework detector owns both package & manual transition refreshes
    frameworkChangeCallback?.({ affectedRoot: '/workspace-a' });
    expect(mockPreviewManager.refreshAllPreviews).not.toHaveBeenCalled();

    frameworkChangeCallback?.({});
    expect(mockPreviewManager.refreshAllPreviews).toHaveBeenCalledTimes(1);

    frameworkChangeCallback?.({ affectedRoot: '/workspace-a-copy' });
    expect(mockPreviewManager.refreshAllPreviews).toHaveBeenCalledTimes(2);

    // unrelated key: no preview work at all
    changeCallback?.(['debugOutput']);
    expect(updateConfiguration).toHaveBeenCalledTimes(2);
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
    const preview = mockPreviewManager.getCurrentPreview();
    (vscode.window as any).visibleTextEditors = [
      {
        document: { uri },
        visibleRanges: [new vscode.Range(20, 0, 30, 0)],
      },
    ];

    syncPreviewScrollFromActiveEditor(preview as never);

    expect(scrollToLine).toHaveBeenCalledTimes(1);
    expect(scrollToLine).toHaveBeenLastCalledWith(24);
    disposeEditorPreviewScrollSync();
    scrollToLine.mockClear();
    (vscode.window as any).visibleTextEditors = [];

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
    expect(revealRange).toHaveBeenCalledTimes(1);
    expect(revealRange.mock.calls[0][0].start.line).toBe(4);

    expect(handlePreviewSourceLineReport(preview as never, 18)).toBe(
      'accepted'
    );

    // reveal anchors reported line at preview 35% ratio
    // visibleLineCount=21, anchorOffset=floor(20*0.35)=7, reportedIdx=17 -> top=10
    expect(revealRange).toHaveBeenCalledTimes(2);
    expect(revealRange.mock.calls[1][0].start.line).toBe(10);
    expect(revealRange.mock.calls[1][1]).toBe(
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
    expect(revealRange).toHaveBeenCalledTimes(3);
    expect(revealRange.mock.calls[2][0].start.line).toBe(52);
    expect(revealRange.mock.calls[2][1]).toBe(
      vscode.TextEditorRevealType.AtTop
    );

    vi.advanceTimersByTime(121);
    visibleRangeCallback?.({
      textEditor: {
        document: { uri },
        visibleRanges: [new vscode.Range(4, 0, 20, 0)],
      } as never,
    });
    expect(scrollToLine).toHaveBeenCalledTimes(2);
    expect(scrollToLine).toHaveBeenLastCalledWith(10);

    visibleRangeCallback?.({
      textEditor: {
        document: { uri },
        visibleRanges: [new vscode.Range(14, 0, 30, 0)],
      } as never,
    });
    expect(scrollToLine).toHaveBeenCalledTimes(2);

    expect(handlePreviewSourceLineReport(preview as never, 44)).toBe('retry');
    vi.advanceTimersByTime(33);
    expect(scrollToLine).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(88);
    expect(handlePreviewSourceLineReport(preview as never, 44)).toBe(
      'accepted'
    );
    expect(revealRange).toHaveBeenCalledTimes(4);

    vi.advanceTimersByTime(121);
    visibleRangeCallback?.({
      textEditor: {
        document: { uri },
        visibleRanges: [new vscode.Range(4, 0, 20, 0)],
      } as never,
    });
    expect(scrollToLine).toHaveBeenCalledTimes(3);
    expect(scrollToLine).toHaveBeenLastCalledWith(10);

    preview.configuration.scrollSync = 'previewToEditor';
    resetPreviewScrollSync(preview as never);

    expect(handlePreviewSourceLineReport(preview as never, 12)).toBe(
      'accepted'
    );
    expect(revealRange).toHaveBeenCalledTimes(5);
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
