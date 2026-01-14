// packages/webview-app/src/components/shims/starlight/Card.tsx
// Starlight Card component shim for MDX Preview
// provides preview-compatible version of @astrojs/starlight/components Card

import React, { ReactNode, ReactElement } from 'react';
import { BaseCard } from '../base';

// Card props (compatible w/ Starlight)
export interface CardProps {
  children: ReactNode;
  title: string;
  icon?: string;
}

// card component
export function Card({ children, title, icon }: CardProps): ReactElement {
  return (
    <BaseCard className="mdx-preview-starlight-card">
      <div className="mdx-preview-starlight-card-header">
        {icon && <span className="mdx-preview-starlight-card-icon">{icon}</span>}
        <span className="mdx-preview-starlight-card-title">{title}</span>
      </div>
      <div className="mdx-preview-starlight-card-content">{children}</div>
    </BaseCard>
  );
}

export default Card;
