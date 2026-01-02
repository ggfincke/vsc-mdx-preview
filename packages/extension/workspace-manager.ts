// packages/extension/workspace-manager.ts
// initialize workspace event handlers for preview updates & folder changes

import * as vscode from 'vscode';
import { workspace, ExtensionContext } from 'vscode';

import { PreviewManager } from './preview/preview-manager';
import { handleDidChangeWorkspaceFolders } from './security/checkFsPath';

const disposables: vscode.Disposable[] = [];

// initialize workspace event handlers
export function initWorkspaceHandlers(_context: ExtensionContext): void {
  workspace.onDidSaveTextDocument(
    (event) => {
      const currentPreview = PreviewManager.getInstance().getCurrentPreview();
      if (currentPreview) {
        currentPreview.handleDidSaveTextDocument(event.uri.fsPath);
      }
    },
    null,
    disposables
  );

  workspace.onDidChangeTextDocument(
    (event) => {
      const currentPreview = PreviewManager.getInstance().getCurrentPreview();
      if (currentPreview) {
        currentPreview.handleDidChangeTextDocument(
          event.document.uri.fsPath,
          event.document
        );
      }
    },
    null,
    disposables
  );

  workspace.onDidChangeConfiguration(() => {
    const currentPreview = PreviewManager.getInstance().getCurrentPreview();
    if (currentPreview) {
      currentPreview.updateConfiguration();
    }
  });

  workspace.onDidChangeWorkspaceFolders(() => {
    handleDidChangeWorkspaceFolders();
  });
}
