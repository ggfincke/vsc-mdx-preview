// packages/webview-app/src/components/shims/generic/types.ts
// shared prop types for generic component shims

import { ReactNode } from 'react';

// callout/alert/admonition types
export type CalloutType =
  | 'note'
  | 'tip'
  | 'warning'
  | 'danger'
  | 'info'
  | 'caution'
  | 'important';

// callout props (shared by Callout, Alert, Admonition)
export interface CalloutProps {
  children: ReactNode;
  type?: CalloutType;
  title?: string;
  icon?: ReactNode;
}

// collapsible/accordion props
export interface CollapsibleProps {
  children: ReactNode;
  title: string;
  defaultOpen?: boolean;
  summary?: string; // alias for title
}

// code group props (multiple code blocks in tabs)
export interface CodeGroupProps {
  children: ReactNode;
  labels?: string[]; // explicit labels for tabs
}

// normalize callout type (handle aliases)
export function normalizeCalloutType(type: string | undefined): CalloutType {
  if (!type) {return 'note';}

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
        [
          'note',
          'tip',
          'warning',
          'danger',
          'info',
          'caution',
          'important',
        ].includes(normalized)
      ) {
        return normalized as CalloutType;
      }
      return 'note';
  }
}

// default titles for callout types
export const CALLOUT_TITLES: Record<CalloutType, string> = {
  note: 'Note',
  tip: 'Tip',
  warning: 'Warning',
  danger: 'Danger',
  info: 'Info',
  caution: 'Caution',
  important: 'Important',
};
