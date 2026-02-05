// packages/extension/commands/security.ts
// security-related commands w/ trust checks

import * as vscode from 'vscode';
import { createTaggedLogger } from '../logging';
import { LogTags } from '@mdx-preview/shared';
import { selectSecurityPolicy } from '../security/security';
import {
  getConfigManager,
  getTrustManager,
  getErrorReporter,
} from '../services';
import { ErrorContext } from '../errors';
import { CommandNames } from './command-names';
import type { CommandDefinition } from '../types';

const log = createTaggedLogger(LogTags.CMD);

const changeSecuritySettings = (): void => {
  selectSecurityPolicy();
};

const toggleScripts = async (): Promise<void> => {
  log.debug('toggleScripts command triggered');

  const trustState = getTrustManager().getState();

  if (!trustState.workspaceTrusted) {
    // handle untrusted workspace - offer to manage trust
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

  // toggle scripts setting for trusted workspace
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
