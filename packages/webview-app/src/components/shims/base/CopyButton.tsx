// packages/webview-app/src/components/shims/base/CopyButton.tsx
// Shared copy-to-clipboard button component

import React, { ReactElement } from 'react';
import { useCopyToClipboard } from './useCopyToClipboard';
import { COPY_ICONS } from './icons';

// props for CopyButton component
export interface CopyButtonProps {
  // text content to copy to clipboard
  text: string;
  // base CSS class for the button (default: 'copy-button')
  className?: string;
  // CSS class added when copied (default: 'copied')
  copiedClassName?: string;
}

// reusable copy-to-clipboard button w/ visual feedback
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
          __html: copied ? COPY_ICONS.check : COPY_ICONS.copy,
        }}
      />
    </button>
  );
}

export default CopyButton;
