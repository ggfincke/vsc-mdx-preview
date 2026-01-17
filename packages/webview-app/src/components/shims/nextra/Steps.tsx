// packages/webview-app/src/components/shims/nextra/Steps.tsx
// Nextra Steps component shim for MDX Preview
// Re-exports Starlight's Steps with Nextra-specific styling wrapper

import React, { ReactNode, ReactElement, HTMLAttributes } from 'react';
import { Steps as StarlightSteps } from '../starlight/Steps';

// Steps props (compatible with Nextra)
export interface StepsProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

// Steps component - wraps Starlight's implementation with Nextra styling
export function Steps({
  children,
  className,
  ...props
}: StepsProps): ReactElement {
  const classes = ['mdx-preview-nextra-steps', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} {...props}>
      <StarlightSteps>{children}</StarlightSteps>
    </div>
  );
}

export default Steps;
