// packages/webview-app/src/components/shims/starlight/LinkCard.tsx
// Starlight LinkCard component shim for MDX Preview
// provides preview-compatible version of @astrojs/starlight/components LinkCard

import React, { ReactElement } from 'react';
import { BaseCard } from '../base';
import { ArrowIcon } from '../base/icons';

// LinkCard props (compatible w/ Starlight)
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
    <BaseCard className="mdx-preview-starlight-link-card" as="a" href={href} openInNewTab>
      <div className="mdx-preview-starlight-link-card-content">
        <span className="mdx-preview-starlight-link-card-title">{title}</span>
        {description && (
          <span className="mdx-preview-starlight-link-card-description">{description}</span>
        )}
      </div>
      <span className="mdx-preview-starlight-link-card-arrow">
        <ArrowIcon />
      </span>
    </BaseCard>
  );
}

export default LinkCard;
