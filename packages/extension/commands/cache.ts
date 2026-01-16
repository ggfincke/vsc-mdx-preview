// packages/extension/commands/cache.ts
// module cache management commands

import * as vscode from 'vscode';
import { debug } from '../logging';
import { clearResolverCache } from '../module-fetcher/resolver-factory';
import { CommandNames } from './command-names';
import type { CommandDefinition } from './types';

const refreshModuleCache = (): void => {
  debug('[CMD] refreshModuleCache command triggered');
  clearResolverCache();
  vscode.window.showInformationMessage('MDX Preview module cache cleared.');
};

export const commands: CommandDefinition[] = [
  { id: CommandNames.REFRESH_MODULE_CACHE, handler: refreshModuleCache },
];
