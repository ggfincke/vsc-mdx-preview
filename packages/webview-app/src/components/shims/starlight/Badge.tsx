// packages/webview-app/src/components/shims/starlight/Badge.tsx
// Starlight Badge component shim for MDX Preview
// provides preview-compatible version of @astrojs/starlight/components Badge

import React, { ReactNode, ReactElement } from 'react';

// badge variants
export type BadgeVariant =
  | 'note'
  | 'tip'
  | 'caution'
  | 'danger'
  | 'success'
  | 'default';

// Badge props (compatible with Starlight)
export interface BadgeProps {
  text: ReactNode;
  variant?: BadgeVariant;
  size?: 'small' | 'medium' | 'large';
}

// badge component
export function Badge({
  text,
  variant = 'default',
  size = 'small',
}: BadgeProps): ReactElement {
  return (
    <span
      className={`starlight-badge starlight-badge-${variant} starlight-badge-${size}`}
    >
      {text}
    </span>
  );
}

export default Badge;
