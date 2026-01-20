// packages/webview-app/src/components/shims/nextra/Callout.tsx
// Nextra Callout component shim for MDX Preview
// Provides preview-compatible version of nextra/components Callout

import React, { ReactNode, ReactElement, HTMLAttributes } from 'react';
import { cn } from '../../../utils/cn';
import {
  NEXTRA_CALLOUT_ICONS,
  type NextraCalloutType,
} from '../base/icons';

// Callout type variants (matching Nextra's official API)
export type CalloutType = NextraCalloutType | null;

// Callout props (compatible with Nextra)
export interface CalloutProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  type?: CalloutType;
  emoji?: ReactNode;
}

/**
 * Nextra Callout component
 * Uses centralized GitHub Primer style icons from icons.ts
 */
export function Callout({
  children,
  type = 'default',
  emoji,
  className,
  ...props
}: CalloutProps): ReactElement {
  // Determine the icon to display
  const IconComponent = type ? NEXTRA_CALLOUT_ICONS[type] : null;
  const icon = emoji ?? (IconComponent ? <IconComponent size={16} /> : null);

  return (
    <aside
      className={cn(
        'mdx-preview-nextra-callout',
        type && `mdx-preview-nextra-callout-${type}`,
        className
      )}
      {...props}
    >
      {icon && <span className="mdx-preview-nextra-callout-icon">{icon}</span>}
      <div className="mdx-preview-nextra-callout-content">{children}</div>
    </aside>
  );
}

export default Callout;
