// packages/extension/commands/security.ts
// security-related commands w/ trust checks

import * as vscode from 'vscode';
import { debug } from '../logging';
import { selectSecurityPolicy } from '../security/security';
import {
  getConfigManager,
  getTrustManager,
  getErrorReporter,
} from '../services';
import { ErrorContext } from '../errors';
import { CommandNames } from './command-names';
import type { CommandDefinition } from './types';

const changeSecuritySettings = (): void => {
  selectSecurityPolicy();
};

const toggleScripts = async (): Promise<void> => {
  debug('[CMD] toggleScripts command triggered');

  const trustState = getTrustManager().getState();

  if (!trustState.workspaceTrusted) {
    // workspace not trusted - offer to manage trust
    await getErrorReporter().reportWithActions(
      new Error('To enable scripts, you must first trust this workspace.'),
      ErrorContext.Security,
      [
        {
          label: 'Manage Trust',
          action: () =>
            vscode.commands.executeCommand('workbench.trust.manage'),
        },
        { label: 'Cancel', action: () => {} },
      ]
    );
    return;
  }

  // workspace is trusted - toggle scripts setting
  const configManager = getConfigManager();
  const scriptsEnabled = configManager.get('preview.enableScripts');

  await configManager.set(
    'preview.enableScripts',
    !scriptsEnabled,
    vscode.ConfigurationTarget.Workspace
  );

  const newState = scriptsEnabled ? 'disabled' : 'enabled';
  vscode.window.showInformationMessage(`MDX Preview scripts ${newState}.`);
};

export const commands: CommandDefinition[] = [
  {
    id: CommandNames.CHANGE_SECURITY_SETTINGS,
    handler: changeSecuritySettings,
  },
  { id: CommandNames.TOGGLE_SCRIPTS, handler: toggleScripts },
];
