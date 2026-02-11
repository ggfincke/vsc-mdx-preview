// tests/extension/commands/theme-selection.test.ts
// unit tests for theme selection QuickPick commands

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';

const mockConfigManager = {
  get: vi.fn(),
  set: vi.fn(async () => {}),
};

const mockPreviewManager = {
  refreshAllPreviews: vi.fn(async () => {}),
};

vi.mock('../../../packages/extension-host/src/app/services', () => ({
  getConfigManager: () => mockConfigManager,
  getPreviewManager: () => mockPreviewManager,
}));

import { commands } from '../../../packages/extension-host/src/features/commands/theme-selection';

describe('theme-selection commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigManager.get.mockReturnValue('github-light');
  });

  describe('selectPreviewTheme', () => {
    const handler = commands.find(
      (c) => c.id === 'mdx-preview.commands.selectPreviewTheme'
    )!.handler;

    it('shows QuickPick w/ preview themes', async () => {
      const spy = vi
        .spyOn(vscode.window, 'showQuickPick')
        .mockResolvedValue(undefined);
      await handler();
      expect(spy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ theme: expect.any(String) }),
        ]),
        expect.objectContaining({
          placeHolder: 'Select preview theme',
          matchOnDescription: true,
        })
      );
    });

    it('marks current theme w/ "(current)"', async () => {
      mockConfigManager.get.mockReturnValue('github-light');
      const spy = vi
        .spyOn(vscode.window, 'showQuickPick')
        .mockResolvedValue(undefined);
      await handler();
      const items = spy.mock.calls[0][0] as any[];
      const current = items.find((i: any) => i.theme === 'github-light');
      expect(current?.description).toBe('(current)');
    });

    it('selection sets config to Global scope & refreshes', async () => {
      vi.spyOn(vscode.window, 'showQuickPick').mockResolvedValue({
        label: 'Atom Dark',
        theme: 'atom-dark',
      } as any);
      await handler();
      expect(mockConfigManager.set).toHaveBeenCalledWith(
        'preview.previewTheme',
        'atom-dark',
        vscode.ConfigurationTarget.Global
      );
      expect(mockPreviewManager.refreshAllPreviews).toHaveBeenCalled();
    });

    it('user cancels → no config change, no refresh', async () => {
      vi.spyOn(vscode.window, 'showQuickPick').mockResolvedValue(undefined);
      await handler();
      expect(mockConfigManager.set).not.toHaveBeenCalled();
      expect(mockPreviewManager.refreshAllPreviews).not.toHaveBeenCalled();
    });
  });

  describe('selectCodeBlockTheme', () => {
    const handler = commands.find(
      (c) => c.id === 'mdx-preview.commands.selectCodeBlockTheme'
    )!.handler;

    it('shows QuickPick w/ code block themes', async () => {
      const spy = vi
        .spyOn(vscode.window, 'showQuickPick')
        .mockResolvedValue(undefined);
      await handler();
      expect(spy).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ placeHolder: 'Select code block theme' })
      );
    });

    it('selection sets codeBlockTheme config', async () => {
      vi.spyOn(vscode.window, 'showQuickPick').mockResolvedValue({
        label: 'Auto',
        theme: 'auto',
      } as any);
      await handler();
      expect(mockConfigManager.set).toHaveBeenCalledWith(
        'preview.codeBlockTheme',
        'auto',
        vscode.ConfigurationTarget.Global
      );
    });
  });

  describe('selectMermaidTheme', () => {
    const handler = commands.find(
      (c) => c.id === 'mdx-preview.commands.selectMermaidTheme'
    )!.handler;

    it('shows QuickPick w/ mermaid themes', async () => {
      const spy = vi
        .spyOn(vscode.window, 'showQuickPick')
        .mockResolvedValue(undefined);
      await handler();
      expect(spy).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          placeHolder: 'Select Mermaid diagram theme',
        })
      );
    });

    it('selection sets mermaidTheme config', async () => {
      vi.spyOn(vscode.window, 'showQuickPick').mockResolvedValue({
        label: 'Auto',
        theme: 'auto',
      } as any);
      await handler();
      expect(mockConfigManager.set).toHaveBeenCalledWith(
        'preview.mermaidTheme',
        'auto',
        vscode.ConfigurationTarget.Global
      );
    });
  });
});
