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
import { disposeEditorPreviewScrollSync } from '../../packages/extension-host/src/features/preview/scroll-sync';

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
  });

  afterEach(() => {
    disposeEditorPreviewScrollSync();
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

  it('live-syncs the preview to the first visible editor line when enabled', () => {
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
    expect(scrollToLine).toHaveBeenLastCalledWith(5);

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
    expect(scrollToLine).toHaveBeenLastCalledWith(15);
  });

  it('does not sync editor scroll when scroll sync is disabled', () => {
    vi.useFakeTimers();
    const uri = vscode.Uri.file('/workspace/test.mdx');
    const scrollToLine = vi.fn();
    mockPreviewManager.getCurrentPreview.mockReturnValue({
      active: true,
      doc: { uri },
      configuration: { scrollSync: 'off' },
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
});
