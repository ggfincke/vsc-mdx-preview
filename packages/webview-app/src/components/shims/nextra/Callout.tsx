// packages/webview-app/src/components/shims/nextra/Callout.tsx
// Nextra Callout component shim for MDX Preview
// Provides preview-compatible version of nextra/components Callout

import React, { ReactNode, ReactElement, HTMLAttributes } from 'react';
import { cn } from '../../../utils/cn';
import { createCallout } from '../base/BaseCallout';
import {
  NEXTRA_CALLOUT_ICONS,
  type NextraCalloutType,
} from '../base/icons';

// Callout type variants (matching Nextra's official API)
export type CalloutType = NextraCalloutType | null;

// Callout props (compatible w/ Nextra)
export interface CalloutProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  type?: CalloutType;
  emoji?: ReactNode;
}

// default (empty) titles - Nextra callouts don't have titles
const NEXTRA_CALLOUT_TITLES: Record<NextraCalloutType, string> = {
  default: '',
  info: '',
  warning: '',
  error: '',
  important: '',
};

// create the base Callout using factory
const BaseCallout = createCallout<NextraCalloutType>({
  classPrefix: 'mdx-preview-nextra-callout',
  types: ['default', 'info', 'warning', 'error', 'important'],
  defaultType: 'default',
  icons: { type: 'component', icons: NEXTRA_CALLOUT_ICONS },
  defaultTitles: NEXTRA_CALLOUT_TITLES,
  layout: 'inline',
});

// Nextra Callout component
// wraps the base callout to support Nextra-specific props (emoji, className, spread props)
export function Callout({
  children,
  type = 'default',
  emoji,
  className,
  ...props
}: CalloutProps): ReactElement {
  // use emoji as custom icon if provided
  const icon = emoji ?? undefined;
  const effectiveType = type ?? 'default';

  return (
    <div
      className={cn('mdx-preview-nextra-callout-wrapper', className)}
      {...props}
    >
      <BaseCallout type={effectiveType} icon={icon}>
        {children}
      </BaseCallout>
    </div>
  );
}

export default Callout;
