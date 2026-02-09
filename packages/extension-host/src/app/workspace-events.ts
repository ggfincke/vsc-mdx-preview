// packages/extension/workspace-manager.ts
// initialize workspace event handlers for preview updates & folder changes

import { workspace, ExtensionContext } from 'vscode';

import { createTaggedLogger } from '../shared/logging/logger';
import { LogTags } from '@mdx-preview/shared';
import { getPreviewManager, getConfigManager } from './services';
import { handleDidChangeWorkspaceFolders } from '../features/module-runtime/security/checkFsPath';
import { PREVIEW_CONFIG_KEYS } from '../shared/config';

// module-level tagged logger
const log = createTaggedLogger(LogTags.WORKSPACE);

// initialize workspace event handlers & register w/ extension context
// disposables added to context.subscriptions for automatic cleanup
export function initWorkspaceHandlers(context: ExtensionContext): void {
  // handle document saves - refresh preview if saved file is relevant
  context.subscriptions.push(
    workspace.onDidSaveTextDocument((event) => {
      try {
        const currentPreview = getPreviewManager().getCurrentPreview();
        if (currentPreview) {
          currentPreview.handleDidSaveTextDocument(event.uri.fsPath);
        }
      } catch (error: unknown) {
        log.error('Error handling document save', error);
      }
    })
  );

  // handle document changes - refresh preview on edit (if configured)
  context.subscriptions.push(
    workspace.onDidChangeTextDocument((event) => {
      try {
        const currentPreview = getPreviewManager().getCurrentPreview();
        if (currentPreview) {
          currentPreview.handleDidChangeTextDocument(
            event.document.uri.fsPath,
            event.document
          );
        }
      } catch (error: unknown) {
        log.error('Error handling document change', error);
      }
    })
  );

  // handle configuration changes - update preview settings via centralized dispatcher
  context.subscriptions.push(
    getConfigManager().onDidChangeKey([...PREVIEW_CONFIG_KEYS], () => {
      const currentPreview = getPreviewManager().getCurrentPreview();
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
