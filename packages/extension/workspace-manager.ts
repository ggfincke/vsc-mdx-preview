// packages/extension/workspace-manager.ts
// initialize workspace event handlers for preview updates & folder changes

import { workspace, ExtensionContext } from 'vscode';

import { PreviewManager } from './preview/preview-manager';
import { handleDidChangeWorkspaceFolders } from './security/checkFsPath';

// initialize workspace event handlers & register w/ extension context (disposables added to context.subscriptions for automatic cleanup)
export function initWorkspaceHandlers(context: ExtensionContext): void {
  // handle document saves - refresh preview if saved file is relevant
  context.subscriptions.push(
    workspace.onDidSaveTextDocument((event) => {
      const currentPreview = PreviewManager.getInstance().getCurrentPreview();
      if (currentPreview) {
        currentPreview.handleDidSaveTextDocument(event.uri.fsPath);
      }
    })
  );

  // handle document changes - refresh preview on edit (if configured)
  context.subscriptions.push(
    workspace.onDidChangeTextDocument((event) => {
      const currentPreview = PreviewManager.getInstance().getCurrentPreview();
      if (currentPreview) {
        currentPreview.handleDidChangeTextDocument(
          event.document.uri.fsPath,
          event.document
        );
      }
    })
  );

  // handle configuration changes - update preview settings
  context.subscriptions.push(
    workspace.onDidChangeConfiguration(() => {
      const currentPreview = PreviewManager.getInstance().getCurrentPreview();
      if (currentPreview) {
        currentPreview.updateConfiguration();
      }
    })
  );

  // handle workspace folder changes - update allowed paths for security
  context.subscriptions.push(
    workspace.onDidChangeWorkspaceFolders(() => {
      handleDidChangeWorkspaceFolders();
    })
  );
}
