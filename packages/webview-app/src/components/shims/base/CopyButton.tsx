// packages/webview-app/src/components/shims/base/CopyButton.tsx
// Shared copy-to-clipboard button component

import React, { ReactElement } from 'react';
import { useCopyToClipboard } from './useCopyToClipboard';
import { CODE_ICONS } from './icons';

/**
 * Props for CopyButton component
 */
export interface CopyButtonProps {
  /** Text content to copy to clipboard */
  text: string;
  /** Base CSS class for the button (default: 'copy-button') */
  className?: string;
  /** CSS class added when copied (default: 'copied') */
  copiedClassName?: string;
}

/**
 * Reusable copy-to-clipboard button with visual feedback.
 *
 * Used by:
 * - Docusaurus CodeBlock
 * - Starlight Code
 *
 * Features:
 * - Shows copy icon, switches to check icon on success
 * - Accessible with title and aria-label
 * - Configurable CSS classes
 *
 * @example
 * ```tsx
 * <CopyButton
 *   text={codeContent}
 *   className="codeblock-copy-button"
 *   copiedClassName="copied"
 * />
 * ```
 */
export function CopyButton({
  text,
  className = 'copy-button',
  copiedClassName = 'copied',
}: CopyButtonProps): ReactElement {
  const { copied, copy } = useCopyToClipboard();

  const buttonClass = copied ? `${className} ${copiedClassName}` : className;

  return (
    <button
      className={buttonClass}
      onClick={() => copy(text)}
      title={copied ? 'Copied!' : 'Copy code'}
      aria-label={copied ? 'Copied!' : 'Copy code'}
    >
      <span
        dangerouslySetInnerHTML={{
          __html: copied ? CODE_ICONS.check : CODE_ICONS.copy,
        }}
      />
    </button>
  );
}

export default CopyButton;
