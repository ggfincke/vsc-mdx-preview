// packages/webview-app/src/components/shims/starlight/Card.tsx
// Starlight Card component shim for MDX Preview
// Provides preview-compatible version of @astrojs/starlight/components Card

import React, { ReactNode, ReactElement } from 'react';
import { BaseCard } from '../base';

// Card props (compatible with Starlight)
export interface CardProps {
  children: ReactNode;
  title: string;
  icon?: string;
}

// Card component
export function Card({ children, title, icon }: CardProps): ReactElement {
  return (
    <BaseCard className="starlight-card">
      <div className="starlight-card-header">
        {icon && <span className="starlight-card-icon">{icon}</span>}
        <span className="starlight-card-title">{title}</span>
      </div>
      <div className="starlight-card-content">{children}</div>
    </BaseCard>
  );
}

export default Card;
