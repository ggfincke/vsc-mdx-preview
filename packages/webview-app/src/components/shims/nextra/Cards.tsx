// packages/webview-app/src/components/shims/nextra/Cards.tsx
// Nextra Cards component shim for MDX Preview
// Provides preview-compatible version of nextra/components Cards
// Uses compound component pattern: Cards and Cards.Card

import React, { ReactNode, ReactElement, HTMLAttributes, CSSProperties } from 'react';

// Cards props (compatible with Nextra)
export interface CardsProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  num?: number; // Number of columns (default: 3)
}

// Card props (for Cards.Card subcomponent)
export interface CardProps extends HTMLAttributes<HTMLAnchorElement | HTMLDivElement> {
  children?: ReactNode;
  icon?: ReactNode;
  title: string;
  href?: string;
  arrow?: boolean;
}

// Arrow icon SVG
const ArrowIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="currentColor"
    className="mdx-preview-nextra-card-arrow"
  >
    <path
      fillRule="evenodd"
      d="M8.22 2.97a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06l2.97-2.97H3.75a.75.75 0 0 1 0-1.5h7.44L8.22 4.03a.75.75 0 0 1 0-1.06Z"
    />
  </svg>
);

// Main Cards component (grid container)
function CardsComponent({
  children,
  num = 3,
  className,
  style,
  ...props
}: CardsProps): ReactElement {
  const classes = ['mdx-preview-nextra-cards', className].filter(Boolean).join(' ');

  // Use CSS custom property for column count
  const gridStyle: CSSProperties = {
    ...style,
    '--nextra-cards-num': num,
  } as CSSProperties;

  return (
    <div className={classes} style={gridStyle} {...props}>
      {children}
    </div>
  );
}

// Card subcomponent (Cards.Card)
function Card({
  children,
  icon,
  title,
  href,
  arrow,
  className,
  ...props
}: CardProps): ReactElement {
  const classes = ['mdx-preview-nextra-card', className].filter(Boolean).join(' ');

  const content = (
    <>
      <div className="mdx-preview-nextra-card-header">
        {icon && <span className="mdx-preview-nextra-card-icon">{icon}</span>}
        <span className="mdx-preview-nextra-card-title">{title}</span>
        {arrow && <ArrowIcon />}
      </div>
      {children && (
        <div className="mdx-preview-nextra-card-content">{children}</div>
      )}
    </>
  );

  // Render as anchor if href is provided, otherwise as div
  if (href) {
    const isExternal = href.startsWith('http://') || href.startsWith('https://');
    return (
      <a
        href={href}
        className={classes}
        target={isExternal ? '_blank' : undefined}
        rel={isExternal ? 'noopener noreferrer' : undefined}
        {...(props as HTMLAttributes<HTMLAnchorElement>)}
      >
        {content}
      </a>
    );
  }

  return (
    <div className={classes} {...(props as HTMLAttributes<HTMLDivElement>)}>
      {content}
    </div>
  );
}

// Attach Card as static property on Cards (compound component pattern)
export const Cards = Object.assign(CardsComponent, { Card });

export default Cards;
