// packages/extension-host/src/features/commands/simple-commands.ts
// simple command handlers (authoring guide & debug output)

import * as vscode from 'vscode';
import { createTaggedLogger, showOutput } from '../../shared/logging/logger';
import { LogTags } from '@mdx-preview/contracts';
import { getConfigManager } from '../../app/services';
import { notifyInfo } from '../../shared/errors';
import { SETTINGS } from '../../shared/config/ConfigManager';
import { CommandNames } from './command-names';
import authoringGuideText from './data/authoring-guide.md';
import type { CommandDefinition } from '../types';

const log = createTaggedLogger(LogTags.CMD);

// copy the full MDX authoring guide to the system clipboard
const copyAuthoringGuide = async (): Promise<void> => {
  log.debug('copyAuthoringGuide command triggered');

  await vscode.env.clipboard.writeText(authoringGuideText);

  notifyInfo('Authoring guide copied to clipboard.');
};

// toggle debug output visibility
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
  { id: CommandNames.COPY_AUTHORING_GUIDE, handler: copyAuthoringGuide },
  { id: CommandNames.TOGGLE_DEBUG_OUTPUT, handler: toggleDebugOutput },
];
