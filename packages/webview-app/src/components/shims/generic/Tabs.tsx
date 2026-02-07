// packages/webview-app/src/components/shims/generic/Tabs.tsx
// generic Tabs component shim for MDX Preview
// provide preview-compatible tabs w/o framework dependency

import { createTabs, type BaseTabsProps, type TabDefinition } from '../base';

// re-export types for compatibility
export type TabsProps = BaseTabsProps;
export type { TabDefinition };

// create generic tabs using the factory
// use 'mdx-preview-generic-tabs' class prefix for styling
const {
  Tabs,
  TabItem,
  useTabsContext: useGenericTabsContext,
  TabsContext: GenericTabsContext,
} = createTabs({
  classPrefix: 'mdx-preview-generic-tabs',
  tabItemClassName: 'mdx-preview-generic-tab-item',
  contextName: 'GenericTabs',
});

export { Tabs, TabItem, useGenericTabsContext, GenericTabsContext };
export default Tabs;
