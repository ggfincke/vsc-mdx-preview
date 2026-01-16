// packages/webview-app/src/components/shims/generic/Collapsible.tsx
// Generic Collapsible/Accordion component shim for MDX Preview
// provides preview-compatible versions of common collapsible patterns

import React, { useState, ReactElement } from 'react';
import { CollapsibleProps } from './types';

// chevron icon for toggle
const CHEVRON_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';

// Collapsible component
export function Collapsible({
  children,
  title,
  defaultOpen = false,
  summary,
}: CollapsibleProps): ReactElement {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const displayTitle = summary || title;

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsOpen(!isOpen);
  };

  return (
    <details
      className="mdx-preview-generic-collapsible"
      open={isOpen}
      onClick={(e) => {
        // prevent native toggle behavior, we handle it ourselves
        if ((e.target as HTMLElement).tagName === 'SUMMARY') {
          e.preventDefault();
        }
      }}
    >
      <summary
        className="mdx-preview-generic-collapsible-summary"
        onClick={handleToggle}
      >
        <span
          className={`mdx-preview-generic-collapsible-icon${isOpen ? ' open' : ''}`}
          dangerouslySetInnerHTML={{ __html: CHEVRON_ICON }}
        />
        <span className="mdx-preview-generic-collapsible-title">
          {displayTitle}
        </span>
      </summary>
      <div className="mdx-preview-generic-collapsible-content">{children}</div>
    </details>
  );
}

// Accordion component (alias for Collapsible)
export function Accordion(props: CollapsibleProps): ReactElement {
  return <Collapsible {...props} />;
}

export default Collapsible;
