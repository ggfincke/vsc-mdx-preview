// packages/extension/commands/preview.ts
// preview lifecycle commands

import { createTaggedLogger } from '../logging';
import { LogTags } from '@mdx-preview/shared';
import {
  openPreview as doOpenPreview,
  refreshPreview as doRefreshPreview,
} from '../preview/preview-manager';
import { CommandNames } from './command-names';
import type { CommandDefinition } from '../types';

const log = createTaggedLogger(LogTags.CMD);

const openPreview = (): void => {
  log.debug('openPreview command triggered');
  doOpenPreview();
};

const refreshPreview = (): void => {
  log.debug('refreshPreview command triggered');
  doRefreshPreview();
};

export const commands: CommandDefinition[] = [
  { id: CommandNames.OPEN_PREVIEW, handler: openPreview },
  { id: CommandNames.REFRESH_PREVIEW, handler: refreshPreview },
];
