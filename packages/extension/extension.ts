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
import { TrustManager, TrustState } from './security/TrustManager';
import { initWebviewAppHTMLResources } from './preview/webview-manager';
import { initWorkspaceHandlers } from './workspace-manager';
import { info, debug, showOutput } from './logging';

// status bar item for showing preview mode
let statusBarItem: vscode.StatusBarItem | undefined;

// create & initialize status bar item
function createStatusBarItem(): vscode.StatusBarItem {
  const item = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  item.command = 'mdx-preview.commands.toggleScripts';
  updateStatusBarItem(item, TrustManager.getInstance().getState());
  return item;
}

// update status bar item based on trust state
function updateStatusBarItem(
  item: vscode.StatusBarItem,
  trustState: TrustState
): void {
  if (trustState.canExecute) {
    item.text = '$(shield) MDX: Trusted';
    item.tooltip =
      'MDX Preview is in Trusted Mode. JavaScript execution is enabled. Click to manage settings.';
    item.backgroundColor = undefined;
  } else {
    item.text = '$(shield) MDX: Safe';
    item.tooltip = trustState.reason
      ? `MDX Preview is in Safe Mode: ${trustState.reason}. Click to manage settings.`
      : 'MDX Preview is in Safe Mode. JavaScript execution is disabled. Click to manage settings.';
    item.backgroundColor = new vscode.ThemeColor(
      'statusBarItem.warningBackground'
    );
  }
}

// show status bar when MDX preview is active
function showStatusBarForMdxPreview(): void {
  if (!statusBarItem) {
    return;
  }

  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const languageId = editor.document.languageId;
    if (languageId === 'mdx' || languageId === 'markdown') {
      statusBarItem.show();
      return;
    }
  }

  // also show if there are any active previews
  const previewManager = PreviewManager.getInstance();
  if (previewManager.hasActivePreviews()) {
    statusBarItem.show();
  } else {
    statusBarItem.hide();
  }
}

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

  // Phase 2.2: Initialize scroll sync
  PreviewManager.getInstance().initScrollSync(context);
  debug('[ACTIVATE] Scroll sync initialized');

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

  // command to toggle scripts setting (only in trusted workspaces)
  const toggleScriptsCommand = vscode.commands.registerCommand(
    'mdx-preview.commands.toggleScripts',
    async () => {
      debug('[CMD] toggleScripts command triggered');

      const trustManager = TrustManager.getInstance();
      const trustState = trustManager.getState();

      if (!trustState.workspaceTrusted) {
        // workspace not trusted - offer to manage trust
        const selection = await vscode.window.showWarningMessage(
          'To enable scripts, you must first trust this workspace.',
          'Manage Trust',
          'Cancel'
        );
        if (selection === 'Manage Trust') {
          await vscode.commands.executeCommand('workbench.trust.manage');
        }
        return;
      }

      // workspace is trusted - toggle scripts setting
      const extensionConfig = vscode.workspace.getConfiguration('mdx-preview');
      const scriptsEnabled = extensionConfig.get<boolean>(
        'preview.enableScripts',
        false
      );

      await extensionConfig.update(
        'preview.enableScripts',
        !scriptsEnabled,
        vscode.ConfigurationTarget.Workspace
      );

      const newState = scriptsEnabled ? 'disabled' : 'enabled';
      vscode.window.showInformationMessage(`MDX Preview scripts ${newState}.`);
    }
  );

  // create and show status bar item
  statusBarItem = createStatusBarItem();
  context.subscriptions.push(statusBarItem);

  // update status bar when active editor changes
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => {
      showStatusBarForMdxPreview();
    })
  );

  // update status bar when trust state changes
  const trustManager = TrustManager.getInstance();
  context.subscriptions.push(
    trustManager.subscribe((newState) => {
      if (statusBarItem) {
        updateStatusBarItem(statusBarItem, newState);
      }
    })
  );

  // show status bar initially if MDX file is open
  showStatusBarForMdxPreview();

  context.subscriptions.push(
    openPreviewCommand,
    refreshPreviewCommand,
    toggleUseVscodeMarkdownStylesCommand,
    toggleUseWhiteBackgroundCommand,
    toggleChangeSecuritySettings,
    toggleScriptsCommand
  );

  debug('[ACTIVATE] Extension activation complete');
}

// deactivate extension
export function deactivate(): void {
  TrustManager.getInstance().dispose();
}
