// packages/webview-app/src/components/shims/starlight/Aside.tsx
// Starlight Aside component shim for MDX Preview
// provides preview-compatible version of @astrojs/starlight/components Aside
// note: this is the JSX alternative to ::: directive syntax

import React, { ReactElement } from 'react';
import { CALLOUT_ICONS } from '../base/icons';

// Aside types (same as admonitions)
export type AsideType = 'note' | 'tip' | 'caution' | 'danger';

// default titles for each aside type
const ASIDE_TITLES: Record<AsideType, string> = {
  note: 'Note',
  tip: 'Tip',
  caution: 'Caution',
  danger: 'Danger',
};

// aside component
export function Aside({
  children,
  type = 'note',
  title,
}: AsideProps): ReactElement {
  const displayTitle = title || ASIDE_TITLES[type];

  return (
    <aside className={`mdx-preview-starlight-aside mdx-preview-starlight-aside-${type}`}>
      <div className="mdx-preview-starlight-aside-header">
        <span
          className="mdx-preview-starlight-aside-icon"
          dangerouslySetInnerHTML={{ __html: CALLOUT_ICONS[type] }}
        />
        <span className="mdx-preview-starlight-aside-title">{displayTitle}</span>
      </div>
      <div className="mdx-preview-starlight-aside-content">{children}</div>
    </aside>
  );
}

export default Aside;
