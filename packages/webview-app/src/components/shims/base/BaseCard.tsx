// packages/webview-app/src/components/shims/base/BaseCard.tsx
// shared base card component for framework shims

import React, { ReactNode, ReactElement } from 'react';

// props for BaseCard component
export interface BaseCardProps {
  children: ReactNode;
  className: string;
  // render as anchor or div
  as?: 'div' | 'a';
  // required when as="a"
  href?: string;
  openInNewTab?: boolean;
  containerProps?: Record<string, unknown>;
}

// base card component that can render as div or anchor
// provide a flexible foundation for Card & LinkCard components
// across different framework shims
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

export default BaseCard;
