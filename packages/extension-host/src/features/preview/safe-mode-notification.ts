// packages/extension-host/src/features/preview/safe-mode-notification.ts
// one-time-per-workspace safe mode explainer shown on first preview open

import * as vscode from 'vscode';
import { getConfigManager } from '../../app/services';
import { getExtensionContext } from '../../app/extension-context';
import { SETTINGS } from '../../shared/config/ConfigManager';
import { EXTENSION_DISPLAY_NAME } from '../../shared/constants';

const SHOWN_STATE_KEY = 'mdx-preview.shownSafeModeNotification';

// show one-time safe mode notification whenever previews will render w/o scripts
// covers untrusted workspaces & trusted-but-scripts-disabled (e.g. folderless windows)
export async function showSafeModeNotificationIfNeeded(): Promise<void> {
  const workspaceTrusted = vscode.workspace.isTrusted;
  const scriptsEnabled = getConfigManager().get(SETTINGS.ENABLE_SCRIPTS);
  if (workspaceTrusted && scriptsEnabled) {
    return;
  }

  const context = getExtensionContext();
  if (!context) {
    return;
  }

  // check if notification already shown for this workspace
  const hasShownNotification =
    context.workspaceState.get<boolean>(SHOWN_STATE_KEY);

  if (hasShownNotification) {
    return;
  }

  // mark shown before awaiting the (user-paced) notification interaction
  await context.workspaceState.update(SHOWN_STATE_KEY, true);

  if (!workspaceTrusted) {
    const selection = await vscode.window.showInformationMessage(
      `${EXTENSION_DISPLAY_NAME} is running in Safe Mode. JavaScript execution is disabled. Trust this workspace & enable scripts for full MDX rendering.`,
      'Manage Trust',
      'Learn More'
    );

    if (selection === 'Manage Trust') {
      await vscode.commands.executeCommand('workbench.trust.manage');
    } else if (selection === 'Learn More') {
      await openGettingStartedWalkthrough();
    }
    return;
  }

  const selection = await vscode.window.showInformationMessage(
    `${EXTENSION_DISPLAY_NAME} renders in Safe Mode by default (static HTML, no JavaScript). Enable scripts for full MDX rendering w/ React components.`,
    'Enable Scripts',
    'Learn More'
  );

  if (selection === 'Enable Scripts') {
    if (vscode.workspace.workspaceFolders) {
      await getConfigManager().set(
        SETTINGS.ENABLE_SCRIPTS,
        true,
        vscode.ConfigurationTarget.Workspace
      );
    } else {
      // no workspace to scope the setting to - let the user flip it deliberately
      await vscode.commands.executeCommand(
        'workbench.action.openSettings',
        'mdx-preview.preview.enableScripts'
      );
    }
  } else if (selection === 'Learn More') {
    await openGettingStartedWalkthrough();
  }
}

async function openGettingStartedWalkthrough(): Promise<void> {
  await vscode.commands.executeCommand(
    'workbench.action.openWalkthrough',
    'ggfincke.vsc-mdx-preview#mdx-preview.gettingStarted'
  );
}
