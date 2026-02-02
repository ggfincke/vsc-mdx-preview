// packages/extension/commands/zoom.ts
// webview zoom control commands

import { debug } from '../logging';
import { LogTags } from '@mdx-preview/shared';
import { getPreviewManager } from '../services';

const zoomIn = async (): Promise<void> => {
  debug(`[${LogTags.CMD}] zoomIn command triggered`);
  const preview = getPreviewManager().getCurrentPreview();
  if (preview?.webviewHandle) {
    await preview.webviewHandle.zoomIn();
  }
};

const zoomOut = async (): Promise<void> => {
  debug(`[${LogTags.CMD}] zoomOut command triggered`);
  const preview = getPreviewManager().getCurrentPreview();
  if (preview?.webviewHandle) {
    await preview.webviewHandle.zoomOut();
  }
};

const resetZoom = async (): Promise<void> => {
  debug(`[${LogTags.CMD}] resetZoom command triggered`);
  const preview = getPreviewManager().getCurrentPreview();
  if (preview?.webviewHandle) {
    await preview.webviewHandle.resetZoom();
  }
};

// zoom commands will be registered as part of views
export const zoomCommands = { zoomIn, zoomOut, resetZoom };
