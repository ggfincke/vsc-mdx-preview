// packages/webview-app/src/components/shims/nextra/Cards.tsx
// Nextra Cards component shim for MDX Preview
// provides preview-compatible version of nextra/components Cards
// uses compound component pattern: Cards & Cards.Card

import React, { ReactNode, ReactElement, HTMLAttributes, CSSProperties } from 'react';
import { cn } from '../../../utils/cn';
import { ArrowIcon } from '../base/icons';

// cards props (compatible w/ Nextra)
export interface CardsProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  // number of columns (default: 3)
  num?: number;
}

// card props (for Cards.Card subcomponent)
export interface CardProps extends HTMLAttributes<HTMLAnchorElement | HTMLDivElement> {
  children?: ReactNode;
  icon?: ReactNode;
  title: string;
  href?: string;
  arrow?: boolean;
}

// main Cards component (grid container)
function CardsComponent({
  children,
  num = 3,
  className,
  style,
  ...props
}: CardsProps): ReactElement {
  // use CSS custom property for column count
  const gridStyle: CSSProperties = {
    ...style,
    '--nextra-cards-num': num,
  } as CSSProperties;

  return (
    <div className={cn('mdx-preview-nextra-cards', className)} style={gridStyle} {...props}>
      {children}
    </div>
  );
}

// card subcomponent (Cards.Card)
function Card({
  children,
  icon,
  title,
  href,
  arrow,
  className,
  ...props
}: CardProps): ReactElement {
  const content = (
    <>
      <div className="mdx-preview-nextra-card-header">
        {icon && <span className="mdx-preview-nextra-card-icon">{icon}</span>}
        <span className="mdx-preview-nextra-card-title">{title}</span>
        {arrow && (
          <ArrowIcon
            size={16}
            variant="github"
            className="mdx-preview-nextra-card-arrow"
          />
        )}
      </div>
      {children && (
        <div className="mdx-preview-nextra-card-content">{children}</div>
      )}
    </>
  );

  // render as anchor if href is provided, otherwise as div
  if (href) {
    const isExternal = href.startsWith('http://') || href.startsWith('https://');
    return (
      <a
        href={href}
        className={cn('mdx-preview-nextra-card', className)}
        target={isExternal ? '_blank' : undefined}
        rel={isExternal ? 'noopener noreferrer' : undefined}
        {...(props as HTMLAttributes<HTMLAnchorElement>)}
      >
        {content}
      </a>
    );
  }

  return (
    <div className={cn('mdx-preview-nextra-card', className)} {...(props as HTMLAttributes<HTMLDivElement>)}>
      {content}
    </div>
  );
}

// attach Card as static property on Cards (compound component pattern)
export const Cards = Object.assign(CardsComponent, { Card });

export default Cards;
