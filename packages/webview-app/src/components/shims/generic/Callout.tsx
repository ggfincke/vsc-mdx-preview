// packages/webview-app/src/components/shims/generic/Callout.tsx
// Generic Callout/Alert/Admonition component shim for MDX Preview
// provides preview-compatible versions of common callout patterns

import { ReactElement } from 'react';
import {
  createCallout,
  type BaseCalloutProps,
} from '../base/BaseCallout';
import { CalloutType, CALLOUT_TITLES } from './types';
import { CALLOUT_ICONS } from '../base/icons';

// Callout props - extends base props for generic callout
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

// Callout component w/ type normalization
export function Callout(props: CalloutProps): ReactElement {
  // normalize type aliases (success -> tip, error -> danger, etc.)
  const normalizedType = normalizeType(props.type);
  return <BaseCallout {...props} type={normalizedType} />;
}

// normalize callout type (handle aliases)
function normalizeType(type: string | undefined): CalloutType {
  if (!type) {
    return 'note';
  }
  const normalized = type.toLowerCase();
  // handle common aliases
  switch (normalized) {
    case 'success':
      return 'tip';
    case 'error':
      return 'danger';
    case 'warn':
      return 'warning';
    case 'hint':
      return 'tip';
    default:
      // check if it's a valid type
      if (
        ['note', 'tip', 'warning', 'danger', 'info', 'caution', 'important'].includes(
          normalized
        )
      ) {
        return normalized as CalloutType;
      }
      return 'note';
  }
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
