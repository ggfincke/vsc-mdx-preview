// packages/webview-app/src/components/shims/generic/Collapsible.tsx
// Generic Collapsible/Accordion component shim for MDX Preview
// provides preview-compatible versions of common collapsible patterns

import React, { ReactElement } from 'react';
import { CollapsibleProps } from './types';
import {
  BaseCollapsible,
  GENERIC_COLLAPSIBLE_CLASSES,
} from '../base/BaseCollapsible';

// Generic Collapsible component
// uses BaseCollapsible w/ custom click handling (prevents native toggle)
export function Collapsible({
  children,
  title,
  defaultOpen = false,
  summary,
}: CollapsibleProps): ReactElement {
  return (
    <BaseCollapsible
      summary={summary || title}
      defaultOpen={defaultOpen}
      classNames={GENERIC_COLLAPSIBLE_CLASSES}
      iconSize={16}
      useNativeToggle={false}
      applyOpenClassToWrapper={true}
    >
      {children}
    </BaseCollapsible>
  );
}

// Accordion component (alias for Collapsible)
export function Accordion(props: CollapsibleProps): ReactElement {
  return <Collapsible {...props} />;
}

export default Collapsible;
