// tests/extension/commands/export.test.ts
// tests HTML export command behavior

import * as vscode from 'vscode';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockPreviewManager } from '../../helpers/mock-services';
import { exportToHtml } from '../../../packages/extension-host/src/features/commands/export';

describe('exportToHtml', () => {
  beforeEach(() => {
    mockPreviewManager.getCurrentPreview.mockReset();
  });

  it('writes exportable HTML to the selected file', async () => {
    const html = '<!DOCTYPE html><html><body>Export</body></html>';
    const getExportableHtml = vi.fn(async () => html);
    mockPreviewManager.getCurrentPreview.mockReturnValue({
      active: true,
      doc: { uri: vscode.Uri.file('/workspace/docs/page.mdx') },
      webviewHandle: { getExportableHtml },
    });
    const saveUri = vscode.Uri.file('/workspace/docs/page.html');
    const saveSpy = vi
      .spyOn(vscode.window, 'showSaveDialog')
      .mockResolvedValue(saveUri);
    const writeSpy = vi
      .spyOn(vscode.workspace.fs, 'writeFile')
      .mockResolvedValue(undefined);
    const infoSpy = vi.spyOn(vscode.window, 'showInformationMessage');

    await exportToHtml();

    expect(getExportableHtml).toHaveBeenCalledTimes(1);
    expect(saveSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultUri: expect.objectContaining({
          fsPath: '/workspace/docs/page.html',
        }),
        filters: { HTML: ['html', 'htm'] },
      })
    );
    expect(writeSpy).toHaveBeenCalledTimes(1);
    const [, bytes] = writeSpy.mock.calls[0];
    expect(new TextDecoder().decode(bytes)).toBe(html);
    expect(infoSpy).toHaveBeenCalledWith(
      'MDX Preview: Exported HTML to /workspace/docs/page.html.'
    );
  });

  it('shows an informational message when no preview is active', async () => {
    mockPreviewManager.getCurrentPreview.mockReturnValue(undefined);
    const saveSpy = vi.spyOn(vscode.window, 'showSaveDialog');
    const infoSpy = vi.spyOn(vscode.window, 'showInformationMessage');

    await exportToHtml();

    expect(saveSpy).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledWith(
      'MDX Preview: Open a preview before exporting HTML.'
    );
  });

  it('does not write a file when the save dialog is canceled', async () => {
    const getExportableHtml = vi.fn(async () => '<!DOCTYPE html>');
    mockPreviewManager.getCurrentPreview.mockReturnValue({
      active: true,
      doc: { uri: vscode.Uri.file('/workspace/docs/page.mdx') },
      webviewHandle: { getExportableHtml },
    });
    vi.spyOn(vscode.window, 'showSaveDialog').mockResolvedValue(undefined);
    const writeSpy = vi.spyOn(vscode.workspace.fs, 'writeFile');

    await exportToHtml();

    expect(getExportableHtml).not.toHaveBeenCalled();
    expect(writeSpy).not.toHaveBeenCalled();
  });
});
