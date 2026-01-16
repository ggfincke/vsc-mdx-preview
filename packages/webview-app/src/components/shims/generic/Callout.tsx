// packages/webview-app/src/components/shims/generic/Callout.tsx
// Generic Callout/Alert/Admonition component shim for MDX Preview
// provides preview-compatible versions of common callout patterns

import React, { ReactElement } from 'react';
import {
  CalloutProps,
  CalloutType,
  normalizeCalloutType,
  CALLOUT_TITLES,
} from './types';

// SVG icons for each callout type
const CALLOUT_ICONS: Record<CalloutType, string> = {
  note: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
  info: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
  tip: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"></path><path d="M10 22h4"></path><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"></path></svg>',
  warning:
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
  caution:
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
  danger:
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>',
  important:
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
};

// Callout component
export function Callout({
  children,
  type,
  title,
  icon,
}: CalloutProps): ReactElement {
  const normalizedType = normalizeCalloutType(type);
  const displayTitle = title || CALLOUT_TITLES[normalizedType];
  const iconSvg = CALLOUT_ICONS[normalizedType];

  return (
    <aside
      className={`mdx-preview-generic-callout mdx-preview-generic-callout-${normalizedType}`}
      data-callout-type={normalizedType}
    >
      <div className="mdx-preview-generic-callout-header">
        {icon ? (
          <span className="mdx-preview-generic-callout-icon">{icon}</span>
        ) : (
          <span
            className="mdx-preview-generic-callout-icon"
            dangerouslySetInnerHTML={{ __html: iconSvg }}
          />
        )}
        <span className="mdx-preview-generic-callout-title">{displayTitle}</span>
      </div>
      <div className="mdx-preview-generic-callout-content">{children}</div>
    </aside>
  );
}

// Alert component (alias for Callout)
export function Alert(props: CalloutProps): ReactElement {
  return <Callout {...props} />;
}

// Admonition component (alias for Callout, Docusaurus style)
export function Admonition(props: CalloutProps): ReactElement {
  return <Callout {...props} />;
}

export default Callout;
