// packages/webview-client/src/features/preview/shared/utils/openSourceLine.ts
// open mapped preview source lines in the editor

import { LogTags } from '@mdx-preview/contracts';
import { ExtensionHandle } from '../../../../platform/rpc/webview-rpc-client';
import { createTaggedLogger } from '../../../../shared/utils/createTaggedLogger';

const log = createTaggedLogger(LogTags.RPC_WEBVIEW);

export function openSourceLine(line: number): void {
  void ExtensionHandle.openSourceLine(line).catch((error) => {
    log.warn('Failed to open source line', error);
  });
}
