// packages/extension-host/src/features/commands/index.ts
// public exports for the command registration system

import * as vscode from 'vscode';
import { createTaggedLogger } from '../../shared/logging/logger';
import { LogTags } from '@mdx-preview/contracts';
import {
  openPreview,
  refreshPreview,
  openPreviewFromUri,
} from '../preview/preview-commands';
import { CommandNames } from './command-names';

const log = createTaggedLogger(LogTags.CMD);

// re-export types & constants
export { CommandNames, type CommandName } from './command-names';

// import command modules
import { commands as configToggleCommands } from './config-toggles';
import { commands as securityCommands } from './security';
import { commands as themeSelectionCommands } from './theme-selection';
import { commands as frameworkSelectionCommands } from './framework-selection';
import { commands as cacheCommands } from './cache';
import { commands as configInfoCommands } from './config-info';
import { commands as simpleCommands } from './simple-commands';
import { commands as exportCommands } from './export';
import { commands as zoomCommands } from './zoom';

import type { CommandDefinition, UriCommandDefinition } from './types';

// aggregate all command definitions from modules
const allCommands: CommandDefinition[] = [
  { id: CommandNames.OPEN_PREVIEW, handler: openPreview },
  { id: CommandNames.REFRESH_PREVIEW, handler: refreshPreview },
  ...configToggleCommands,
  ...securityCommands,
  ...themeSelectionCommands,
  ...frameworkSelectionCommands,
  ...cacheCommands,
  ...configInfoCommands,
  ...simpleCommands,
  ...exportCommands,
  ...zoomCommands,
];

// Uri commands for context menus
const allUriCommands: UriCommandDefinition[] = [
  { id: CommandNames.OPEN_PREVIEW_FROM_EXPLORER, handler: openPreviewFromUri },
];

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
