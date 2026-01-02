// packages/extension/extension.ts
// * extension activation & deactivation w/ trust management & command registration

'use strict';

import * as vscode from 'vscode';

import {
  openPreview,
  refreshPreview,
  PreviewManager,
} from './preview/preview-manager';
import { selectSecurityPolicy } from './security/security';
import { TrustManager } from './security/TrustManager';
import { initWebviewAppHTMLResources } from './preview/webview-manager';
import { initWorkspaceHandlers } from './workspace-manager';
import { info, debug, showOutput } from './logging';

// show one-time safe mode notification in untrusted workspaces
async function showSafeModeNotificationIfNeeded(
  context: vscode.ExtensionContext
): Promise<void> {
  if (vscode.workspace.isTrusted) {
    return;
  }

  // check if notification already shown for this workspace
  const hasShownNotification = context.workspaceState.get<boolean>(
    'mdx-preview.shownSafeModeNotification'
  );

  if (hasShownNotification) {
    return;
  }

  const selection = await vscode.window.showInformationMessage(
    'MDX Preview is running in Safe Mode. JavaScript execution is disabled. Trust this workspace & enable scripts for full MDX rendering.',
    'Manage Trust',
    'Learn More'
  );

  if (selection === 'Manage Trust') {
    await vscode.commands.executeCommand('workbench.trust.manage');
  } else if (selection === 'Learn More') {
    await vscode.commands.executeCommand(
      'workbench.action.openWalkthrough',
      'xyc.vscode-mdx-preview#mdx-preview.gettingStarted'
    );
  }

  // mark as shown for this workspace
  await context.workspaceState.update(
    'mdx-preview.shownSafeModeNotification',
    true
  );
}

// set up workspace trust event handlers (uses onDidChangeWorkspaceTrust for grant & revoke)
function setupTrustHandlers(context: vscode.ExtensionContext): void {
  const workspaceWithTrust = vscode.workspace as typeof vscode.workspace & {
    onDidChangeWorkspaceTrust?: vscode.Event<boolean>;
  };

  const handleTrustChange = async (trusted: boolean): Promise<void> => {
    const previewManager = PreviewManager.getInstance();

    // refresh all previews to reflect new trust state
    previewManager.refreshAllPreviews();

    if (trusted) {
      // offer to enable scripts
      const selection = await vscode.window.showInformationMessage(
        'Workspace trusted. Enable scripts for full MDX rendering w/ React components?',
        'Enable Scripts',
        'Not Now'
      );

      if (selection === 'Enable Scripts') {
        await vscode.workspace
          .getConfiguration('mdx-preview')
          .update(
            'preview.enableScripts',
            true,
            vscode.ConfigurationTarget.Workspace
          );
      }
    } else {
      // show safe mode notification if trust was revoked
      showSafeModeNotificationIfNeeded(context);
    }
  };

  if (workspaceWithTrust.onDidChangeWorkspaceTrust) {
    // when workspace trust changes (grant or revoke)
    context.subscriptions.push(
      workspaceWithTrust.onDidChangeWorkspaceTrust(handleTrustChange)
    );
  } else {
    // fallback for older VS Code versions (grant only)
    context.subscriptions.push(
      vscode.workspace.onDidGrantWorkspaceTrust(() => handleTrustChange(true))
    );
  }

  // when enableScripts setting changes, refresh previews
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('mdx-preview.preview.enableScripts')) {
        const previewManager = PreviewManager.getInstance();
        previewManager.refreshAllPreviews();
      }
    })
  );
}

// * activate extension
export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  debug('[ACTIVATE] Starting extension activation...');

  // initialize resources (async)
  debug('[ACTIVATE] Initializing webview HTML resources...');
  await initWebviewAppHTMLResources(context);
  debug('[ACTIVATE] Webview HTML resources initialized');

  initWorkspaceHandlers(context);
  debug('[ACTIVATE] Workspace handlers initialized');

  info('Extension activated');

  // show output channel automatically for debugging
  showOutput();

  // show safe mode notification if in untrusted workspace
  showSafeModeNotificationIfNeeded(context);

  // set up trust event handlers
  setupTrustHandlers(context);

  // register commands
  const openPreviewCommand = vscode.commands.registerCommand(
    'mdx-preview.commands.openPreview',
    () => {
      debug('[CMD] openPreview command triggered');
      openPreview();
    }
  );

  const refreshPreviewCommand = vscode.commands.registerCommand(
    'mdx-preview.commands.refreshPreview',
    () => {
      debug('[CMD] refreshPreview command triggered');
      refreshPreview();
    }
  );

  const toggleUseVscodeMarkdownStylesCommand = vscode.commands.registerCommand(
    'mdx-preview.commands.toggleUseVscodeMarkdownStyles',
    () => {
      const extensionConfig = vscode.workspace.getConfiguration('mdx-preview');
      const useVscodeMarkdownStyles = extensionConfig.get<boolean>(
        'preview.useVscodeMarkdownStyles',
        false
      );
      extensionConfig.update(
        'preview.useVscodeMarkdownStyles',
        !useVscodeMarkdownStyles
      );
    }
  );

  const toggleUseWhiteBackgroundCommand = vscode.commands.registerCommand(
    'mdx-preview.commands.toggleUseWhiteBackground',
    () => {
      const extensionConfig = vscode.workspace.getConfiguration('mdx-preview');
      const useWhiteBackground = extensionConfig.get<boolean>(
        'preview.useWhiteBackground',
        false
      );
      extensionConfig.update('preview.useWhiteBackground', !useWhiteBackground);
    }
  );

  const toggleChangeSecuritySettings = vscode.commands.registerCommand(
    'mdx-preview.commands.changeSecuritySettings',
    () => {
      selectSecurityPolicy();
    }
  );

  context.subscriptions.push(
    openPreviewCommand,
    refreshPreviewCommand,
    toggleUseVscodeMarkdownStylesCommand,
    toggleUseWhiteBackgroundCommand,
    toggleChangeSecuritySettings
  );

  debug('[ACTIVATE] Extension activation complete');
}

// deactivate extension
export function deactivate(): void {
  TrustManager.getInstance().dispose();
}
