// packages/webview-app/src/components/shims/docusaurus/Details.tsx
// Docusaurus Details component shim for MDX Preview
// provides preview-compatible version of @theme/Details

import React, { ReactNode, ReactElement } from 'react';
import {
  BaseCollapsible,
  DOCUSAURUS_DETAILS_CLASSES,
} from '../base/BaseCollapsible';

// Details props (compatible w/ Docusaurus)
export interface DetailsProps {
  children: ReactNode;
  summary?: ReactNode;
  open?: boolean;
  className?: string;
}

// * Docusaurus Details component
// uses BaseCollapsible w/ native toggle handling (more semantic)
export function Details({
  children,
  summary = 'Details',
  open: defaultOpen = false,
  className,
}: DetailsProps): ReactElement {
  return (
    <BaseCollapsible
      summary={summary}
      defaultOpen={defaultOpen}
      className={className}
      classNames={DOCUSAURUS_DETAILS_CLASSES}
      iconSize={14}
      useNativeToggle={true}
      applyOpenClassToWrapper={false}
    >
      {children}
    </BaseCollapsible>
  );
}

// default export for compatibility
export default Details;
