// packages/extension/commands/index.ts
// public exports for the command registration system

import * as vscode from 'vscode';
import { debug } from '../logging';

// re-export types & constants
export * from './types';
export { CommandNames, type CommandName } from './command-names';

// import command modules
import { commands as previewCommands } from './preview';
import { commands as configToggleCommands } from './config-toggles';
import { commands as securityCommands } from './security';
import { commands as themeSelectionCommands } from './theme-selection';
import { commands as zoomCommands } from './zoom';
import { commands as frameworkSelectionCommands } from './framework-selection';
import { commands as cacheCommands } from './cache';

import type { CommandDefinition } from './types';

// All command definitions aggregated from modules.
const allCommands: CommandDefinition[] = [
  ...previewCommands,
  ...configToggleCommands,
  ...securityCommands,
  ...themeSelectionCommands,
  ...zoomCommands,
  ...frameworkSelectionCommands,
  ...cacheCommands,
];

// register all MDX Preview commands w/ VS Code
//
// @example
// // In extension.ts activate()
// context.subscriptions.push(...registerAllCommands());
export function registerAllCommands(): vscode.Disposable[] {
  debug('[COMMANDS] Registering all commands...');

  const disposables = allCommands.map(({ id, handler }) => {
    debug(`[COMMANDS] Registering: ${id}`);
    return vscode.commands.registerCommand(id, handler);
  });

  debug(`[COMMANDS] Registered ${disposables.length} commands`);
  return disposables;
}
