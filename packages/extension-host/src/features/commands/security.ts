// packages/extension-host/src/features/commands/security.ts
// security-related commands w/ trust checks

import * as vscode from 'vscode';
import { createTaggedLogger } from '../../shared/logging/logger';
import { LogTags } from '@mdx-preview/contracts';
import { selectSecurityPolicy } from '../security/security';
import {
  getConfigManager,
  getTrustManager,
  getErrorReporter,
  getPreviewManager,
} from '../../app/services';
import { ErrorContext } from '../../shared/errors';
import { EXTENSION_DISPLAY_NAME } from '../../shared/constants';
import { SETTINGS } from '../../shared/config/ConfigManager';
import { CommandNames } from './command-names';
import type { CommandDefinition } from './types';

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
  const scriptsEnabled = configManager.get(SETTINGS.ENABLE_SCRIPTS);

  await configManager.set(
    SETTINGS.ENABLE_SCRIPTS,
    !scriptsEnabled,
    vscode.ConfigurationTarget.Workspace
  );

  try {
    await getPreviewManager().refreshAllPreviews();
  } catch (error) {
    log.error('Failed to refresh previews after script toggle', error);
  }

  const newState = scriptsEnabled ? 'disabled' : 'enabled';
  vscode.window.showInformationMessage(
    `${EXTENSION_DISPLAY_NAME} scripts ${newState}.`
  );
};

export const commands: CommandDefinition[] = [
  {
    id: CommandNames.CHANGE_SECURITY_SETTINGS,
    handler: changeSecuritySettings,
  },
  { id: CommandNames.TOGGLE_SCRIPTS, handler: toggleScripts },
];
