// packages/webview-app/src/components/shims/generic/Tabs.tsx
// Generic Tabs component shim for MDX Preview
// Provides preview-compatible tabs without framework dependency

import { createTabs, type BaseTabsProps, type TabDefinition } from '../base';

// Re-export types for compatibility
export type TabsProps = BaseTabsProps;
export type { TabDefinition };

// Create generic tabs using the factory
// Uses 'mdx-preview-generic-tabs' class prefix for styling
const {
  Tabs,
  useTabsContext: useGenericTabsContext,
  TabsContext: GenericTabsContext,
} = createTabs({
  classPrefix: 'mdx-preview-generic-tabs',
  contextName: 'GenericTabs',
});

export { Tabs, useGenericTabsContext, GenericTabsContext };
export default Tabs;
