// tests/extension/workspace-events.test.ts
// ensure workspace config handler wires preview updates for runtime setting keys

import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import {
  mockConfigManager,
  mockPreviewManager,
} from '../helpers/mock-services';
import { initWorkspaceHandlers } from '../../packages/extension-host/src/app/workspace-events';
import { SETTINGS } from '../../packages/extension-host/src/shared/config';

describe('workspace-events', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (vscode.workspace as any).onDidSaveTextDocument = vi.fn(() => ({
      dispose: vi.fn(),
    }));
    (vscode.workspace as any).onDidChangeTextDocument = vi.fn(() => ({
      dispose: vi.fn(),
    }));
    (vscode.workspace as any).onDidChangeWorkspaceFolders = vi.fn(() => ({
      dispose: vi.fn(),
    }));
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
        SETTINGS.SHOW_FRONTMATTER,
        SETTINGS.SHOW_TOC,
        SETTINGS.SOURCE_LINE_HIGHLIGHT,
        SETTINGS.SOURCE_LINE_HIGHLIGHT_COLOR,
        SETTINGS.SHIM_SIDE_RAIL,
      ]),
      expect.any(Function)
    );
    expect(context.subscriptions.length).toBe(4);

    changeCallback?.();
    expect(updateConfiguration).toHaveBeenCalledTimes(1);
  });
});
