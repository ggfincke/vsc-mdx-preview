// packages/webview-app/src/components/shims/generic/Callout.tsx
// Generic Callout/Alert/Admonition component shim for MDX Preview
// provides preview-compatible versions of common callout patterns

import React, { ReactElement } from 'react';
import {
  CalloutProps,
  normalizeCalloutType,
  CALLOUT_TITLES,
} from './types';
import { CALLOUT_ICONS } from '../base/icons';

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
