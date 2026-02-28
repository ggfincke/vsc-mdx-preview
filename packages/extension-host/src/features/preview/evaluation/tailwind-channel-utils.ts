// packages/extension-host/src/features/preview/evaluation/tailwind-channel-utils.ts
// shared Tailwind channel reset for preview evaluation stages

import type { Preview } from '../Preview';

export function clearTailwindChannels(
  preview: Preview,
  webviewHandle: Preview['webviewHandle']
): void {
  const tailwindRequestId = preview.nextTailwindRequestId();
  if (!preview.isTailwindRequestCurrent(tailwindRequestId)) {
    return;
  }

  preview.updateTailwindWatchFiles([]);
  webviewHandle.setTailwindBrowserCss('');
  webviewHandle.setTailwindCss('');
}
