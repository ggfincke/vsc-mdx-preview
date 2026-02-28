// packages/extension-host/src/features/commands/debug.ts
// debug output toggle command

import * as vscode from 'vscode';
import { createTaggedLogger, showOutput } from '../../shared/logging/logger';
import { LogTags } from '@mdx-preview/contracts';
import { getConfigManager } from '../../app/services';
import { SETTINGS } from '../../shared/config/ConfigManager';
import { CommandNames } from './command-names';
import type { CommandDefinition } from '../types';

const log = createTaggedLogger(LogTags.CMD);

const toggleDebugOutput = async (): Promise<void> => {
  log.debug('toggleDebugOutput command triggered');

  const config = getConfigManager();
  const current = config.get(SETTINGS.DEBUG_OUTPUT);
  await config.set(SETTINGS.DEBUG_OUTPUT, !current);

  if (!current) {
    // show output channel when enabling debug
    showOutput();
  }

  await vscode.window.showInformationMessage(
    `Debug output ${!current ? 'enabled' : 'disabled'}`
  );
};

export const commands: CommandDefinition[] = [
  { id: CommandNames.TOGGLE_DEBUG_OUTPUT, handler: toggleDebugOutput },
];
