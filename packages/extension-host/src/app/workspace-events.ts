// packages/extension-host/src/app/workspace-events.ts
// initialize workspace event handlers for preview updates & folder changes

import { workspace, window, ExtensionContext } from 'vscode';

import { createTaggedLogger } from '../shared/logging/logger';
import { LogTags } from '@mdx-preview/contracts';
import { getPreviewManager, getConfigManager } from './services';
import { handleDidChangeWorkspaceFolders } from '../features/module-runtime/security/checkFsPath';
import { PREVIEW_CONFIG_KEYS, PREVIEW_SETTING_ACTIONS } from '../shared/config';
import {
  disposeEditorPreviewScrollSync,
  handleEditorVisibleRangesChange,
} from '../features/preview/scroll-sync';

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
  // recompile-class keys force a webview update; the rest flow through
  // updateConfiguration's diff-based flags (runtime push, css watcher, refresh)
  const previewKeySet = new Set<string>(PREVIEW_CONFIG_KEYS);
  context.subscriptions.push(
    getConfigManager().onDidChangeConfiguration((affectedKeys) => {
      const changed = affectedKeys.filter((k) => previewKeySet.has(k));
      if (changed.length === 0) {
        return;
      }
      const currentPreview = getPreviewManager().getCurrentPreview();
      if (!currentPreview) {
        return;
      }
      currentPreview.updateConfiguration();
      const needsRecompile = changed.some(
        (k) =>
          PREVIEW_SETTING_ACTIONS[k as keyof typeof PREVIEW_SETTING_ACTIONS] ===
          'recompile'
      );
      if (needsRecompile) {
        void currentPreview.updateWebview(true).catch((err) => {
          log.error('Failed to recompile after setting change', err);
        });
      }
    })
  );

  // handle workspace folder changes - update allowed paths for security
  context.subscriptions.push(
    workspace.onDidChangeWorkspaceFolders(() => {
      handleDidChangeWorkspaceFolders();
    })
  );

  // handle editor scroll changes for opt-in preview sync
  const editorScrollSubscription = window.onDidChangeTextEditorVisibleRanges(
    handleEditorVisibleRangesChange
  );
  context.subscriptions.push({
    dispose: () => {
      editorScrollSubscription.dispose();
      disposeEditorPreviewScrollSync();
    },
  });
}
