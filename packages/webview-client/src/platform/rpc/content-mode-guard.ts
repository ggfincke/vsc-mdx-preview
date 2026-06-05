// packages/webview-client/src/platform/rpc/content-mode-guard.ts
// validate preview content modes against the latest webview trust state

import type { TaggedLogger, TrustState } from '@mdx-preview/contracts';

export function canAcceptContentMode(
  trustState: TrustState | null,
  contentMode: 'safe' | 'trusted',
  log: TaggedLogger
): boolean {
  if (contentMode !== 'trusted') {
    return true;
  }

  if (trustState?.canExecute === true) {
    return true;
  }

  log.warn(
    trustState
      ? 'Discarding trusted content - trust state is not canExecute (scripts disabled or workspace untrusted)'
      : 'Discarding trusted content - trust state has not been received'
  );
  return false;
}

// gate trusted render on resolved trust state (App always provides a value)
export function canRenderTrusted(trustState: TrustState): boolean {
  return trustState.canExecute === true;
}
