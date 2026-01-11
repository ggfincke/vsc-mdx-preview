// packages/webview-app/src/components/shims/starlight/Steps.tsx
// Starlight Steps component shim for MDX Preview
// Provides preview-compatible version of @astrojs/starlight/components Steps

import React, { ReactNode, ReactElement } from 'react';

// Steps props (compatible with Starlight)
export interface StepsProps {
  children: ReactNode;
}

// Steps component - renders numbered steps from ordered list children
export function Steps({ children }: StepsProps): ReactElement {
  return <div className="starlight-steps">{children}</div>;
}

export default Steps;
