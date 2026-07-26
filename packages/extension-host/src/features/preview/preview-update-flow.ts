// packages/extension-host/src/features/preview/preview-update-flow.ts
// extracted update routing flow for Preview.updateWebview

import * as vscode from 'vscode';
import { TextDecoder } from 'util';
import { createTaggedLogger } from '../../shared/logging/logger';
import { readFileRequiredAsync } from '../../shared/utils/file-utils';
import { LogTags, type UpdateModeValue } from '@mdx-preview/contracts';

const log = createTaggedLogger(LogTags.PREVIEW);

interface RenderedVersionTracker {
  hasRenderedVersion(documentUri: string, version: number): boolean;
  markRendered(documentUri: string, version: number): void;
}

export interface PreviewUpdateFlowInput {
  force?: boolean;
  doc: vscode.TextDocument;
  text: string;
  entryFsDirectory: string | null;
  updateMode: UpdateModeValue;
  // stale-evaluation guard: false once a newer update flow has started
  isCurrent?: () => boolean;
  getDocumentTracker: () => RenderedVersionTracker | undefined;
  evaluate: (text: string, fsPath: string) => Promise<void>;
}

export async function runPreviewUpdateFlow(
  input: PreviewUpdateFlowInput
): Promise<void> {
  const {
    doc,
    text,
    entryFsDirectory,
    updateMode,
    getDocumentTracker,
    evaluate,
  } = input;
  const force = input.force ?? false;
  const { uri } = doc;
  const { scheme, fsPath } = uri;

  log.debug('updateWebview called');
  log.debug(`updateWebview scheme=${scheme}, fsPath=${fsPath}`);

  const currentVersion = doc.version;
  const documentUri = uri.toString();
  const docTracker = getDocumentTracker();

  if (!force && docTracker?.hasRenderedVersion(documentUri, currentVersion)) {
    log.debug('Skipping update - same version');
    return;
  }

  switch (scheme) {
    case 'untitled': {
      log.debug('updateWebview: untitled scheme');
      await evaluate(text, entryFsDirectory ?? '');
      break;
    }
    case 'file': {
      log.debug('updateWebview: file scheme');
      if (updateMode === 'onType') {
        await evaluate(text, fsPath);
        break;
      }

      const savedText = await readFileRequiredAsync(fsPath, 'utf8');
      await evaluate(savedText, fsPath);
      break;
    }
    default: {
      log.debug(`updateWebview: default scheme (${scheme})`);
      let sourceText = text;
      if (updateMode !== 'onType') {
        try {
          const bytes = await vscode.workspace.fs.readFile(uri);
          sourceText = new TextDecoder().decode(bytes);
        } catch {
          sourceText = text;
        }
      }

      await evaluate(sourceText, fsPath);
      break;
    }
  }

  // stale flow: a newer evaluation started mid-flight; don't rewind version tracking
  if (input.isCurrent?.() === false) {
    log.debug('Skipping markRendered - stale evaluation');
    return;
  }

  docTracker?.markRendered(documentUri, currentVersion);
}
