// packages/extension/preview/preview-commands.ts
// preview command handlers for opening & refreshing previews

import * as vscode from 'vscode';
import { debug } from '../logging';
import { getPreviewManager } from '../services';

import { createOrShowPanel, refreshPanel } from './webview-manager';
import { Preview } from './Preview';

// * open MDX preview for the active editor document
// creates a new Preview instance or reuses existing one
export async function openPreview(): Promise<void> {
  debug('[PREVIEW] openPreview called');
  if (!vscode.window.activeTextEditor) {
    debug('[PREVIEW] No active text editor, aborting');
    return;
  }
  const doc = vscode.window.activeTextEditor.document;
  debug(`[PREVIEW] Opening preview for: ${doc.uri.fsPath}`);
  const manager = getPreviewManager();
  let currentPreview = manager.getCurrentPreview();

  if (!currentPreview) {
    debug('[PREVIEW] Creating new Preview instance');
    currentPreview = new Preview(doc);
    manager.setCurrentPreview(currentPreview);
  } else {
    debug('[PREVIEW] Reusing existing Preview instance');
    currentPreview.setDoc(doc);
  }
  debug('[PREVIEW] Calling createOrShowPanel');
  await createOrShowPanel(currentPreview);
  debug('[PREVIEW] Calling updateWebview');
  await currentPreview.updateWebview();
  debug('[PREVIEW] openPreview complete');
}

// refresh the current MDX preview
// forces a full re-render of the preview content
export async function refreshPreview(): Promise<void> {
  debug('[PREVIEW] refreshPreview called');
  const currentPreview = getPreviewManager().getCurrentPreview();
  if (!currentPreview) {
    debug('[PREVIEW] No current preview, aborting refresh');
    return;
  }
  refreshPanel(currentPreview);
  await currentPreview.updateWebview(true);
  debug('[PREVIEW] refreshPreview complete');
}
