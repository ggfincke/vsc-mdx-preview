// packages/extension-host/src/features/preview/preview-refresh-flow.ts
// extracted refresh flow for Preview.refreshWebview

import { createTaggedLogger } from '../../shared/logging/logger';
import { LogTags } from '@mdx-preview/contracts';
import type { Preview } from './Preview';

const log = createTaggedLogger(LogTags.PREVIEW);

export interface PreviewRefreshFlowInput {
  getCurrentPreview: () => Preview | undefined;
  refreshPanel: (preview: Preview) => void;
  updateWebviewForce: () => Promise<void>;
}

export async function runPreviewRefreshFlow(
  input: PreviewRefreshFlowInput
): Promise<void> {
  log.debug('refreshWebview called');
  const currentPreview = input.getCurrentPreview();
  if (!currentPreview) {
    return;
  }

  input.refreshPanel(currentPreview);
  await input.updateWebviewForce();
}
