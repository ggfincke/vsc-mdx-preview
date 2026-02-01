// packages/extension/commands/index.ts
// public exports for the command registration system

import * as vscode from 'vscode';
import { debug } from '../logging';
import { LogTags } from '@mdx-preview/shared';

// re-export types & constants
export { CommandNames, type CommandName } from './command-names';

// import command modules
import { commands as previewCommands } from './preview';
import { commands as configToggleCommands } from './config-toggles';
import { commands as securityCommands } from './security';
import { commands as themeSelectionCommands } from './theme-selection';
import { commands as frameworkSelectionCommands } from './framework-selection';
import { commands as cacheCommands } from './cache';
import { commands as configInfoCommands } from './config-info';
import { commands as debugCommands } from './debug';

import type { CommandDefinition } from '../types';

// all command definitions aggregated from modules
const allCommands: CommandDefinition[] = [
  ...previewCommands,
  ...configToggleCommands,
  ...securityCommands,
  ...themeSelectionCommands,
  ...frameworkSelectionCommands,
  ...cacheCommands,
  ...configInfoCommands,
  ...debugCommands,
];

// register all MDX Preview commands w/ VS Code
export function registerAllCommands(): vscode.Disposable[] {
  debug(`[${LogTags.COMMANDS}] Registering all commands...`);

  const disposables = allCommands.map(({ id, handler }) => {
    debug(`[${LogTags.COMMANDS}] Registering: ${id}`);
    return vscode.commands.registerCommand(id, handler);
  });

  debug(`[${LogTags.COMMANDS}] Registered ${disposables.length} commands`);
  return disposables;
}
