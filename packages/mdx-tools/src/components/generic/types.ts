// packages/webview-app/src/components/shims/generic/types.ts
// shared prop types for generic component shims

import type { ReactNode } from 'react';
import {
  type CalloutType,
  normalizeCalloutType,
  CALLOUT_TITLES,
} from '../../internal/callout';

// re-export callout types & utilities for consumers
export { type CalloutType, normalizeCalloutType, CALLOUT_TITLES };

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
  // alias for title
  summary?: string;
}

// code group props (multiple code blocks in tabs)
export interface CodeGroupProps {
  children: ReactNode;
  // explicit labels for tabs
  labels?: string[];
}
