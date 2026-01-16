// packages/extension/commands/preview.ts
// preview lifecycle commands

import { debug } from '../logging';
import {
  openPreview as doOpenPreview,
  refreshPreview as doRefreshPreview,
} from '../preview/preview-manager';
import { CommandNames } from './command-names';
import type { CommandDefinition } from './types';

const openPreview = (): void => {
  debug('[CMD] openPreview command triggered');
  doOpenPreview();
};

const refreshPreview = (): void => {
  debug('[CMD] refreshPreview command triggered');
  doRefreshPreview();
};

export const commands: CommandDefinition[] = [
  { id: CommandNames.OPEN_PREVIEW, handler: openPreview },
  { id: CommandNames.REFRESH_PREVIEW, handler: refreshPreview },
];
