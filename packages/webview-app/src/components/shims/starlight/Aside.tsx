// packages/webview-app/src/components/shims/starlight/Aside.tsx
// Starlight Aside component shim for MDX Preview
// provides preview-compatible version of @astrojs/starlight/components Aside
// note: this is the JSX alternative to ::: directive syntax

import { ReactElement } from 'react';
import { createCallout, type BaseCalloutProps } from '../base/BaseCallout';
import { CALLOUT_ICONS } from '../base/icons';

// aside types (same as admonitions)
export type AsideType = 'note' | 'tip' | 'caution' | 'danger';

// aside component props
export type AsideProps = BaseCalloutProps<AsideType>;

// default titles for each aside type
const ASIDE_TITLES: Record<AsideType, string> = {
  note: 'Note',
  tip: 'Tip',
  caution: 'Caution',
  danger: 'Danger',
};

// create the Aside using factory
const BaseAside = createCallout<AsideType>({
  classPrefix: 'mdx-preview-starlight-aside',
  types: ['note', 'tip', 'caution', 'danger'],
  defaultType: 'note',
  icons: { type: 'svg', icons: CALLOUT_ICONS },
  defaultTitles: ASIDE_TITLES,
  layout: 'header',
});

// aside component
export function Aside(props: AsideProps): ReactElement {
  return <BaseAside {...props} />;
}

export default Aside;
