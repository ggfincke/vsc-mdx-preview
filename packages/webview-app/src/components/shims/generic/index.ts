// packages/webview-app/src/components/shims/generic/index.ts
// barrel exports for generic component shims

// Types
export {
  type CalloutType,
  type CalloutProps,
  type CollapsibleProps,
  type CodeGroupProps,
  normalizeCalloutType,
  CALLOUT_TITLES,
} from './types';

// Callout components
export { Callout, Alert, Admonition } from './Callout';

// Collapsible components
export { Collapsible, Accordion } from './Collapsible';

// Tab components
export { Tabs, useGenericTabsContext, type TabsProps } from './Tabs';
export { TabItem, Tab } from './TabItem';

// Code group
export { CodeGroup } from './CodeGroup';

// Import styles (side effect)
import './styles.css';
