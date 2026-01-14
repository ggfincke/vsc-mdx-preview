// packages/webview-app/src/components/shims/starlight/Steps.tsx
// Starlight Steps component shim for MDX Preview
// provides preview-compatible version of @astrojs/starlight/components Steps

import React, { ReactNode, ReactElement } from 'react';

// Steps props (compatible w/ Starlight)
export interface StepsProps {
  children: ReactNode;
}

// steps component - renders numbered steps from ordered list children
export function Steps({ children }: StepsProps): ReactElement {
  return <div className="mdx-preview-starlight-steps">{children}</div>;
}

export default Steps;
