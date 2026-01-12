// packages/webview-app/src/components/shims/starlight/LinkCard.tsx
// Starlight LinkCard component shim for MDX Preview
// provides preview-compatible version of @astrojs/starlight/components LinkCard

import React, { ReactElement } from 'react';
import { BaseCard, ArrowIcon } from '../base';

// LinkCard props (compatible with Starlight)
export interface LinkCardProps {
  title: string;
  description?: string;
  href: string;
}

// link card component
export function LinkCard({
  title,
  description,
  href,
}: LinkCardProps): ReactElement {
  return (
    <BaseCard className="starlight-link-card" as="a" href={href} openInNewTab>
      <div className="starlight-link-card-content">
        <span className="starlight-link-card-title">{title}</span>
        {description && (
          <span className="starlight-link-card-description">{description}</span>
        )}
      </div>
      <span className="starlight-link-card-arrow">
        <ArrowIcon />
      </span>
    </BaseCard>
  );
}

export default LinkCard;
