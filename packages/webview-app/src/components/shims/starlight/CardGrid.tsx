// packages/webview-app/src/components/shims/starlight/CardGrid.tsx
// Starlight CardGrid component shim for MDX Preview
// Provides preview-compatible version of @astrojs/starlight/components CardGrid

import React, { ReactNode, ReactElement } from 'react';

// CardGrid props (compatible with Starlight)
export interface CardGridProps {
  children: ReactNode;
  stagger?: boolean;
}

// CardGrid component
export function CardGrid({ children, stagger = false }: CardGridProps): ReactElement {
  return (
    <div className={`starlight-card-grid${stagger ? ' stagger' : ''}`}>
      {children}
    </div>
  );
}

export default CardGrid;
