// packages/extension-host/src/features/commands/zoom.ts
// preview-level zoom commands (Zoom In, Zoom Out, Reset Zoom)

import { createTaggedLogger } from '../../shared/logging/logger';
import { LogTags } from '@mdx-preview/contracts';
import { getPreviewManager } from '../../app/services';
import { CommandNames } from './command-names';
import type { CommandDefinition } from './types';

const log = createTaggedLogger(LogTags.CMD);

const ZOOM_STEP = 0.1;

function adjustZoom(delta: number): void {
  const preview = getPreviewManager().getCurrentPreview();
  if (!preview?.active) {
    return;
  }
  preview.webviewHandle.adjustZoom(delta);
}

const zoomIn = (): void => {
  log.debug('zoomIn command triggered');
  adjustZoom(ZOOM_STEP);
};

const zoomOut = (): void => {
  log.debug('zoomOut command triggered');
  adjustZoom(-ZOOM_STEP);
};

const resetZoom = (): void => {
  log.debug('resetZoom command triggered');
  const preview = getPreviewManager().getCurrentPreview();
  if (!preview?.active) {
    return;
  }
  preview.webviewHandle.resetZoom();
};

export const commands: CommandDefinition[] = [
  { id: CommandNames.ZOOM_IN, handler: zoomIn },
  { id: CommandNames.ZOOM_OUT, handler: zoomOut },
  { id: CommandNames.RESET_ZOOM, handler: resetZoom },
];
