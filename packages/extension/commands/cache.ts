// packages/extension/commands/cache.ts
// module & webview cache management commands

import * as vscode from 'vscode';
import { createTaggedLogger } from '../logging';
import { LogTags } from '@mdx-preview/shared';
import { clearResolverCache } from '../module-system/resolver/resolver-factory';
import { clearSassCache } from '../module-system/handlers';
import { clearUnmanagedCaches } from '../cache-subsystem';
import { getPreviewManager } from '../services';
import { CommandNames } from './command-names';
import type { CommandDefinition } from '../types';

const log = createTaggedLogger(LogTags.CMD);

// comprehensive command - clears all extension & webview caches
const clearAllCaches = async (): Promise<void> => {
  log.debug('clearAllCaches command triggered');

  // extension-side caches (resolver & sass)
  clearResolverCache();
  clearSassCache();

  // additional unmanaged caches (components, path security)
  clearUnmanagedCaches();

  // webview-side caches (via RPC to all active previews)
  const previewManager = getPreviewManager();
  await previewManager.clearAllWebviewCaches();

  vscode.window.showInformationMessage(
    'MDX Preview: All caches cleared (resolver, Sass, components, security, webview modules).'
  );
};

export const commands: CommandDefinition[] = [
  { id: CommandNames.CLEAR_ALL_CACHES, handler: clearAllCaches },
];
