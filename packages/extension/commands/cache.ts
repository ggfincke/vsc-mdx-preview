// packages/extension/commands/cache.ts
// module & webview cache management commands

import * as vscode from 'vscode';
import { debug } from '../logging';
import { LogTags } from '@mdx-preview/shared';
import { clearResolverCache } from '../module-system/resolver/resolver-factory';
import { clearSassCache } from '../module-system/handlers';
import { getPreviewManager } from '../services';
import { CommandNames } from './command-names';
import type { CommandDefinition } from '../types';

// legacy command - clears resolver cache only (backwards compatibility)
const refreshModuleCache = (): void => {
  debug(`[${LogTags.CMD}] refreshModuleCache command triggered`);
  clearResolverCache();
  vscode.window.showInformationMessage('MDX Preview module cache cleared.');
};

// new comprehensive command - clears all extension & webview caches
const clearAllCaches = async (): Promise<void> => {
  debug(`[${LogTags.CMD}] clearAllCaches command triggered`);

  // extension-side caches
  clearResolverCache();
  clearSassCache();

  // webview-side caches (via RPC to all active previews)
  const previewManager = getPreviewManager();
  await previewManager.clearAllWebviewCaches();

  vscode.window.showInformationMessage(
    'MDX Preview: All caches cleared (resolver, Sass, webview modules).'
  );
};

export const commands: CommandDefinition[] = [
  { id: CommandNames.REFRESH_MODULE_CACHE, handler: refreshModuleCache },
  { id: CommandNames.CLEAR_ALL_CACHES, handler: clearAllCaches },
];
