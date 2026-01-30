// packages/extension/commands/cache.ts
// module cache management commands

import * as vscode from 'vscode';
import { debug } from '../logging';
import { LogTags } from '@mdx-preview/shared';
import { clearResolverCache } from '../module-system/resolver/resolver-factory';
import { CommandNames } from './command-names';
import type { CommandDefinition } from '../types';

const refreshModuleCache = (): void => {
  debug(`[${LogTags.CMD}] refreshModuleCache command triggered`);
  clearResolverCache();
  vscode.window.showInformationMessage('MDX Preview module cache cleared.');
};

export const commands: CommandDefinition[] = [
  { id: CommandNames.REFRESH_MODULE_CACHE, handler: refreshModuleCache },
];
