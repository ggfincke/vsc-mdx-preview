// packages/extension-host/src/features/commands/zoom.ts
// preview-level zoom commands (Zoom In, Zoom Out, Reset Zoom)

import { createTaggedLogger } from '../../shared/logging/logger';
import { LogTags } from '@mdx-preview/contracts';
import { getPreviewManager } from '../../app/services';
import { CommandNames } from './command-names';
import type { CommandDefinition } from './types';

const log = createTaggedLogger(LogTags.COMMANDS);

const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3.0;
const ZOOM_DEFAULT = 1.0;

// module-level zoom tracking (not a VS Code setting — transient UI preference)
let currentZoomLevel = ZOOM_DEFAULT;

// clamp & round to 2 decimal places
function clampZoom(level: number): number {
  return Math.round(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, level)) * 100) / 100;
}

// push zoom level to the active preview's webview
function pushZoom(level: number): void {
  currentZoomLevel = level;
  const preview = getPreviewManager().getCurrentPreview();
  if (!preview?.active) {
    return;
  }
  const handle = preview.webviewHandle;
  if (handle) {
    handle.setZoom(level);
  }
}

const zoomIn = (): void => {
  log.debug('zoomIn command triggered');
  pushZoom(clampZoom(currentZoomLevel + ZOOM_STEP));
};

const zoomOut = (): void => {
  log.debug('zoomOut command triggered');
  pushZoom(clampZoom(currentZoomLevel - ZOOM_STEP));
};

const resetZoom = (): void => {
  log.debug('resetZoom command triggered');
  pushZoom(ZOOM_DEFAULT);
};

export const commands: CommandDefinition[] = [
  { id: CommandNames.ZOOM_IN, handler: zoomIn },
  { id: CommandNames.ZOOM_OUT, handler: zoomOut },
  { id: CommandNames.RESET_ZOOM, handler: resetZoom },
];
