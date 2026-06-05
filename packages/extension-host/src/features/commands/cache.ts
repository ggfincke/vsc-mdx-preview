// packages/extension-host/src/features/commands/cache.ts
// module & webview cache management commands

import { createTaggedLogger } from '../../shared/logging/logger';
import { LogTags } from '@mdx-preview/contracts';
import { clearResolverCache } from '../module-runtime/resolution/resolver-factory';
import { clearSassCache } from '../module-runtime/handlers';
import { clearUnmanagedCaches } from '../../app/lifecycle/cache-subsystem';
import { getPreviewManager } from '../../app/services';
import { notifyInfo } from '../../shared/errors';
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

  notifyInfo(
    'All caches cleared (resolver, Sass, components, security, webview modules).'
  );
};

export const commands: CommandDefinition[] = [
  { id: CommandNames.CLEAR_ALL_CACHES, handler: clearAllCaches },
];
