// packages/extension-host/src/features/commands/cache.ts
// module & webview cache management commands

import { createTaggedLogger } from '../../shared/logging/logger';
import { LogTags } from '@mdx-preview/contracts';
import { clearExtensionCaches } from '../../app/lifecycle/cache-subsystem';
import { getPreviewManager } from '../../app/services';
import { notifyInfo } from '../../shared/errors';
import { CommandNames } from './command-names';
import type { CommandDefinition } from './types';

const log = createTaggedLogger(LogTags.CMD);

// comprehensive command - clears all extension & webview caches
const clearAllCaches = async (): Promise<void> => {
  log.debug('clearAllCaches command triggered');

  clearExtensionCaches();

  // webview-side caches (via RPC to all active previews)
  const previewManager = getPreviewManager();
  await previewManager.clearAllWebviewCaches();

  notifyInfo(
    'All caches cleared (resolution, transforms, config, Tailwind, icons, & webview modules).'
  );
};

export const commands: CommandDefinition[] = [
  { id: CommandNames.CLEAR_ALL_CACHES, handler: clearAllCaches },
];
