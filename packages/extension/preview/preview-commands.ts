// packages/extension/preview/preview-commands.ts
// preview command handlers for opening & refreshing previews

import * as vscode from 'vscode';
import { debug } from '../logging';
import { LogTags } from '@mdx-preview/shared';
import { getPreviewManager } from '../services';

import { createOrShowPanel, refreshPanel } from './webview-manager';
import { Preview } from './Preview';

// open MDX preview for active editor document (create or reuse Preview instance)
export async function openPreview(): Promise<void> {
  debug(`[${LogTags.PREVIEW}] openPreview called`);
  if (!vscode.window.activeTextEditor) {
    debug(`[${LogTags.PREVIEW}] No active text editor, aborting`);
    return;
  }
  const doc = vscode.window.activeTextEditor.document;
  debug(`[${LogTags.PREVIEW}] Opening preview for: ${doc.uri.fsPath}`);
  const manager = getPreviewManager();
  let currentPreview = manager.getCurrentPreview();

  if (!currentPreview) {
    debug(`[${LogTags.PREVIEW}] Creating new Preview instance`);
    currentPreview = new Preview(doc);
    manager.setCurrentPreview(currentPreview);
  } else {
    debug(`[${LogTags.PREVIEW}] Reusing existing Preview instance`);
    currentPreview.setDoc(doc);
  }
  debug(`[${LogTags.PREVIEW}] Calling createOrShowPanel`);
  await createOrShowPanel(currentPreview);
  debug(`[${LogTags.PREVIEW}] Calling updateWebview`);
  await currentPreview.updateWebview();
  debug(`[${LogTags.PREVIEW}] openPreview complete`);
}

// refresh current MDX preview (force full re-render)
export async function refreshPreview(): Promise<void> {
  debug(`[${LogTags.PREVIEW}] refreshPreview called`);
  const currentPreview = getPreviewManager().getCurrentPreview();
  if (!currentPreview) {
    debug(`[${LogTags.PREVIEW}] No current preview, aborting refresh`);
    return;
  }
  refreshPanel(currentPreview);
  await currentPreview.updateWebview(true);
  debug(`[${LogTags.PREVIEW}] refreshPreview complete`);
}
