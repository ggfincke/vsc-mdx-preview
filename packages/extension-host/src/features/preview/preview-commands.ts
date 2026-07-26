// packages/extension-host/src/features/preview/preview-commands.ts
// preview command handlers for opening & refreshing previews

import * as vscode from 'vscode';
import { LogTags } from '@mdx-preview/contracts';

import { createTaggedLogger } from '../../shared/logging/logger';
import { getPreviewManager, getErrorReporter } from '../../app/services';
import { ErrorContext } from '../../shared/errors/ErrorReporter';
import { createOrShowPanel, refreshPanel } from './webview-manager';
import { Preview } from './Preview';
import { showSafeModeNotificationIfNeeded } from './safe-mode-notification';

// module-level tagged logger
const log = createTaggedLogger(LogTags.PREVIEW);

// shared open-preview core: create-or-reuse Preview, show panel, update webview
async function openPreviewForDoc(doc: vscode.TextDocument): Promise<void> {
  log.debug(`Opening preview for: ${doc.uri.fsPath}`);
  const manager = getPreviewManager();
  let currentPreview = manager.getCurrentPreview();

  if (!currentPreview) {
    log.debug('Creating new Preview instance');
    currentPreview = new Preview(doc);
    manager.setCurrentPreview(currentPreview);
  } else {
    log.debug('Reusing existing Preview instance');
    currentPreview.setDoc(doc);
  }
  log.debug('Calling createOrShowPanel');
  await createOrShowPanel(currentPreview, openPreview);

  // first-use explainer tied to actual preview usage, not extension activation
  void showSafeModeNotificationIfNeeded().catch((error) => {
    log.debug('Failed to show safe mode notification', error);
  });

  log.debug('Calling updateWebview');
  try {
    await currentPreview.updateWebview();
  } catch (error: unknown) {
    log.error('Failed to update preview', error);
    getErrorReporter().reportToUser(error, ErrorContext.Extension);
  }
}

// open MDX preview for active editor document (create or reuse Preview instance)
export async function openPreview(): Promise<void> {
  log.debug('openPreview called');
  if (!vscode.window.activeTextEditor) {
    log.debug('No active text editor, aborting');
    return;
  }
  const doc = vscode.window.activeTextEditor.document;
  await openPreviewForDoc(doc);
  log.debug('openPreview complete');
}

// open MDX preview for a specific Uri (for Explorer context menu)
// falls back to active editor if no uri provided
export async function openPreviewFromUri(uri?: vscode.Uri): Promise<void> {
  log.debug('openPreviewFromUri called', uri?.fsPath);
  let doc: vscode.TextDocument | undefined;

  if (uri) {
    doc = await vscode.workspace.openTextDocument(uri);
  } else {
    doc = vscode.window.activeTextEditor?.document;
  }

  if (!doc) {
    log.debug('No document to preview, aborting');
    return;
  }

  await openPreviewForDoc(doc);

  log.debug('openPreviewFromUri complete');
}

// refresh current MDX preview (force full re-render)
export async function refreshPreview(): Promise<void> {
  log.debug('refreshPreview called');
  const currentPreview = getPreviewManager().getCurrentPreview();
  if (!currentPreview) {
    log.debug('No current preview, aborting refresh');
    return;
  }
  refreshPanel(currentPreview);
  try {
    await currentPreview.updateWebview(true);
  } catch (error: unknown) {
    log.error('Failed to refresh preview', error);
    getErrorReporter().reportToUser(error, ErrorContext.Extension);
  }
  log.debug('refreshPreview complete');
}
