// packages/webview-app/src/components/shims/base/useCopyToClipboard.ts
// Shared hook for copy-to-clipboard functionality

import { useState, useCallback } from 'react';
import { CODE_COPY_FEEDBACK_DURATION_MS } from '../../../constants';

/**
 * Result from useCopyToClipboard hook
 */
export interface UseCopyToClipboardResult {
  /** Whether the copy was successful (shows feedback state) */
  copied: boolean;
  /** Function to copy text to clipboard */
  copy: (text: string) => Promise<void>;
}

/**
 * Hook for copy-to-clipboard functionality with visual feedback.
 *
 * Used by:
 * - Docusaurus CodeBlock
 * - Starlight Code
 * - CopyButton component
 *
 * @returns Object with copied state and copy function
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { copied, copy } = useCopyToClipboard();
 *
 *   return (
 *     <button onClick={() => copy('Hello!')}>
 *       {copied ? 'Copied!' : 'Copy'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useCopyToClipboard(): UseCopyToClipboardResult {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), CODE_COPY_FEEDBACK_DURATION_MS);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);

  return { copied, copy };
}
