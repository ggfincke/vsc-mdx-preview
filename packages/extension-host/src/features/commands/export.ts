// packages/extension-host/src/features/commands/export.ts
// export rendered preview content to standalone files

import * as path from 'path';
import * as vscode from 'vscode';
import { createTaggedLogger } from '../../shared/logging/logger';
import { LogTags } from '@mdx-preview/contracts';
import { getPreviewManager } from '../../app/services';
import { notifyInfo, notifyError } from '../../shared/errors';
import { EXTENSION_DISPLAY_NAME } from '../../shared/constants';
import { CommandNames } from './command-names';
import type { CommandDefinition } from './types';

const log = createTaggedLogger(LogTags.CMD);

function getDefaultHtmlUri(docUri: vscode.Uri): vscode.Uri | undefined {
  if (docUri.scheme !== 'file') {
    return undefined;
  }

  const parsedPath = path.parse(docUri.fsPath);
  return vscode.Uri.file(path.join(parsedPath.dir, `${parsedPath.name}.html`));
}

export async function exportToHtml(): Promise<void> {
  log.debug('exportToHtml command triggered');

  const preview = getPreviewManager().getCurrentPreview();
  if (!preview?.active) {
    notifyInfo('Open a preview before exporting HTML.');
    return;
  }

  try {
    const targetUri = await vscode.window.showSaveDialog({
      defaultUri: getDefaultHtmlUri(preview.doc.uri),
      filters: {
        HTML: ['html', 'htm'],
      },
      saveLabel: 'Export HTML',
      title: `Export ${EXTENSION_DISPLAY_NAME} as HTML`,
    });

    if (!targetUri) {
      return;
    }

    const html = await preview.webviewHandle.getExportableHtml();
    await vscode.workspace.fs.writeFile(
      targetUri,
      new TextEncoder().encode(html)
    );
    notifyInfo(`Exported HTML to ${targetUri.fsPath}.`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    log.error('Failed to export HTML', error);
    notifyError(`Failed to export HTML — ${reason}`);
  }
}

export const commands: CommandDefinition[] = [
  { id: CommandNames.EXPORT_TO_HTML, handler: exportToHtml },
];
