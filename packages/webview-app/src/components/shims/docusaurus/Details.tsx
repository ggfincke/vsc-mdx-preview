// packages/webview-app/src/components/shims/docusaurus/Details.tsx
// Docusaurus Details component shim for MDX Preview
// Provides preview-compatible version of @theme/Details

import React, { ReactNode, ReactElement, useState } from 'react';

// Details props (compatible with Docusaurus)
export interface DetailsProps {
  children: ReactNode;
  summary?: ReactNode;
  open?: boolean;
  className?: string;
}

// Details component (collapsible section)
export function Details({
  children,
  summary = 'Details',
  open: defaultOpen = false,
  className,
}: DetailsProps): ReactElement {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <details
      className={`docusaurus-details${className ? ` ${className}` : ''}`}
      open={isOpen}
      onToggle={(e) => setIsOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="details-summary">
        <span className="details-toggle-icon">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={isOpen ? 'expanded' : ''}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </span>
        <span className="details-summary-text">{summary}</span>
      </summary>
      <div className="details-content">{children}</div>
    </details>
  );
}

// default export for compatibility
export default Details;
