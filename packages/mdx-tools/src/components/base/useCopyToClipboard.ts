// packages/webview-app/src/components/shims/base/useCopyToClipboard.ts
// shared hook for copy-to-clipboard functionality

import { useState, useCallback } from 'react';
import { copyToClipboard } from '../internal/clipboard';
import { CODE_COPY_FEEDBACK_DURATION_MS } from '../internal/constants';

// result from useCopyToClipboard hook
export interface UseCopyToClipboardResult {
  // feedback state
  copied: boolean;
  copy: (text: string) => Promise<void>;
}

// hook for copy-to-clipboard functionality w/ visual feedback
export function useCopyToClipboard(): UseCopyToClipboardResult {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (text: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), CODE_COPY_FEEDBACK_DURATION_MS);
    }
  }, []);

  return { copied, copy };
}
