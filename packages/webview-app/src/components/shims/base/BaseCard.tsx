// packages/webview-app/src/components/shims/base/BaseCard.tsx
// Shared base card component for framework shims

import React, { ReactNode, ReactElement } from 'react';

// Props for BaseCard component
export interface BaseCardProps {
  // /** Card content */
  children: ReactNode;
  // /** Main CSS class for the card container */
  className: string;
  // /** Render as anchor tag instead of div */
  as?: 'div' | 'a';
  // /** Link href (required when as="a") */
  href?: string;
  // /** Open link in new tab */
  openInNewTab?: boolean;
  // /** Additional props to spread on the container */
  containerProps?: Record<string, unknown>;
}

// Base card component that can render as div or anchor
// Provides a flexible foundation for Card & LinkCard components
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

// Common card header component
export interface CardHeaderProps {
  title: string;
  icon?: ReactNode;
  className?: string;
  titleClassName?: string;
  iconClassName?: string;
}

// Reusable card header w/ optional icon
export function CardHeader({
  title,
  icon,
  className = 'card-header',
  titleClassName = 'card-title',
  iconClassName = 'card-icon',
}: CardHeaderProps): ReactElement {
  return (
    <div className={className}>
      {icon && <span className={iconClassName}>{icon}</span>}
      <span className={titleClassName}>{title}</span>
    </div>
  );
}

// Arrow icon for link cards
export function ArrowIcon(): ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

export default BaseCard;
