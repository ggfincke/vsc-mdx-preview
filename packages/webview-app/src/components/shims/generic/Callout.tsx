// packages/webview-app/src/components/shims/generic/Callout.tsx
// Generic Callout/Alert/Admonition component shim for MDX Preview
// provides preview-compatible versions of common callout patterns

import { ReactElement } from 'react';
import {
  createCallout,
  type BaseCalloutProps,
} from '../base/BaseCallout';
import { CalloutType, CALLOUT_TITLES, normalizeCalloutType } from './types';
import { CALLOUT_ICONS } from '../base/icons';

// callout props - extends base props for generic callout
export type CalloutProps = BaseCalloutProps<CalloutType>;

// create the base Callout using factory
const BaseCallout = createCallout<CalloutType>({
  classPrefix: 'mdx-preview-generic-callout',
  types: ['note', 'tip', 'warning', 'danger', 'info', 'caution', 'important'],
  defaultType: 'note',
  icons: { type: 'svg', icons: CALLOUT_ICONS },
  defaultTitles: CALLOUT_TITLES,
  layout: 'header',
});

// callout component w/ type normalization
export function Callout(props: CalloutProps): ReactElement {
  // normalize type aliases (success -> tip, error -> danger, etc.)
  const normalizedType = normalizeCalloutType(props.type);
  return <BaseCallout {...props} type={normalizedType} />;
}

// alert component (alias for Callout)
export function Alert(props: CalloutProps): ReactElement {
  return <Callout {...props} />;
}

// admonition component (alias for Callout, Docusaurus style)
export function Admonition(props: CalloutProps): ReactElement {
  return <Callout {...props} />;
}

export default Callout;
