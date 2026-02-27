// packages/extension/commands/index.ts
// public exports for the command registration system

import * as vscode from 'vscode';
import { createTaggedLogger } from '../../shared/logging/logger';
import { LogTags } from '@mdx-preview/contracts';

const log = createTaggedLogger(LogTags.COMMANDS);

// re-export types & constants
export { CommandNames, type CommandName } from './command-names';

// import command modules
import {
  commands as previewCommands,
  uriCommands as previewUriCommands,
} from './preview';
import { commands as configToggleCommands } from './config-toggles';
import { commands as securityCommands } from './security';
import { commands as themeSelectionCommands } from './theme-selection';
import { commands as frameworkSelectionCommands } from './framework-selection';
import { commands as cacheCommands } from './cache';
import { commands as configInfoCommands } from './config-info';
import { commands as debugCommands } from './debug';
import { commands as authoringGuideCommands } from './authoring-guide';

import type { CommandDefinition, UriCommandDefinition } from './types';

// aggregate all command definitions from modules
const allCommands: CommandDefinition[] = [
  ...previewCommands,
  ...configToggleCommands,
  ...securityCommands,
  ...themeSelectionCommands,
  ...frameworkSelectionCommands,
  ...cacheCommands,
  ...configInfoCommands,
  ...debugCommands,
  ...authoringGuideCommands,
];

// aggregate all Uri command definitions (accept optional vscode.Uri from context menus)
const allUriCommands: UriCommandDefinition[] = [...previewUriCommands];

// register all MDX Preview commands w/ VS Code
export function registerAllCommands(): vscode.Disposable[] {
  log.debug('Registering all commands...');

  const disposables = allCommands.map(({ id, handler }) => {
    log.debug(`Registering: ${id}`);
    return vscode.commands.registerCommand(id, handler);
  });

  // register Uri commands (may receive vscode.Uri from context menus)
  const uriDisposables = allUriCommands.map(({ id, handler }) => {
    log.debug(`Registering Uri command: ${id}`);
    return vscode.commands.registerCommand(id, handler);
  });

  log.debug(
    `Registered ${disposables.length + uriDisposables.length} commands`
  );
  return [...disposables, ...uriDisposables];
}
