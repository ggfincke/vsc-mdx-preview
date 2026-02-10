// packages/webview-app/src/components/shims/starlight/CardGrid.tsx
// Starlight CardGrid component shim for MDX Preview
// provide preview-compatible version of @astrojs/starlight/components CardGrid

import React, { ReactNode, ReactElement } from 'react';

// cardGrid props (compatible w/ Starlight)
export interface CardGridProps {
  children: ReactNode;
  stagger?: boolean;
}

// card grid component
export function CardGrid({
  children,
  stagger = false,
}: CardGridProps): ReactElement {
  return (
    <div className={`mdx-preview-starlight-card-grid${stagger ? ' stagger' : ''}`}>
      {children}
    </div>
  );
}

export default CardGrid;
