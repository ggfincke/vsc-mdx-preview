// packages/webview-app/src/components/shims/base/BaseCard.tsx
// shared base card component for framework shims

import React, { ReactNode, ReactElement } from 'react';

// Props for BaseCard component
export interface BaseCardProps {
  // card content
  children: ReactNode;
  // main CSS class for the card container
  className: string;
  // render as anchor tag instead of div
  as?: 'div' | 'a';
  // link href (required when as="a")
  href?: string;
  // open link in new tab
  openInNewTab?: boolean;
  // additional props to spread on the container
  containerProps?: Record<string, unknown>;
}

// base card component that can render as div or anchor
// provides a flexible foundation for Card & LinkCard components
// across different framework shims.
export function BaseCard({
  children,
  className,
  as = 'div',
  href,
  openInNewTab = false,
  containerProps = {},
}: BaseCardProps): ReactElement {
  if (as === 'a' && href) {
    return (
      <a
        href={href}
        className={className}
        target={openInNewTab ? '_blank' : undefined}
        rel={openInNewTab ? 'noopener noreferrer' : undefined}
        {...containerProps}
      >
        {children}
      </a>
    );
  }

  return (
    <div className={className} {...containerProps}>
      {children}
    </div>
  );
}

// Re-export ArrowIcon from centralized icons for backwards compatibility
// Starlight LinkCard imports this
export { ArrowIcon } from './icons';

export default BaseCard;
