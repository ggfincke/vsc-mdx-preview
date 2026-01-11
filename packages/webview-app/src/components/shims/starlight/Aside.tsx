// packages/webview-app/src/components/shims/starlight/Aside.tsx
// Starlight Aside component shim for MDX Preview
// Provides preview-compatible version of @astrojs/starlight/components Aside
// Note: This is the JSX alternative to ::: directive syntax

import React, { ReactNode, ReactElement } from 'react';

// Aside types (same as admonitions)
export type AsideType = 'note' | 'tip' | 'caution' | 'danger';

// Aside props (compatible with Starlight)
export interface AsideProps {
  children: ReactNode;
  type?: AsideType;
  title?: string;
}

// icons for each aside type
const ASIDE_ICONS: Record<AsideType, string> = {
  note: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
  tip: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"></path><path d="M10 22h4"></path><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"></path></svg>',
  caution: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
  danger: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>',
};

// default titles for each aside type
const ASIDE_TITLES: Record<AsideType, string> = {
  note: 'Note',
  tip: 'Tip',
  caution: 'Caution',
  danger: 'Danger',
};

// Aside component
export function Aside({
  children,
  type = 'note',
  title,
}: AsideProps): ReactElement {
  const displayTitle = title || ASIDE_TITLES[type];

  return (
    <aside className={`starlight-aside starlight-aside-${type}`}>
      <div className="starlight-aside-header">
        <span
          className="starlight-aside-icon"
          dangerouslySetInnerHTML={{ __html: ASIDE_ICONS[type] }}
        />
        <span className="starlight-aside-title">{displayTitle}</span>
      </div>
      <div className="starlight-aside-content">{children}</div>
    </aside>
  );
}

export default Aside;
