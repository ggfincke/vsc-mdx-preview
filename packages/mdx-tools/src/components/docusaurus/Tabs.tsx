// packages/webview-app/src/components/shims/docusaurus/Tabs.tsx
// Docusaurus Tabs/TabItem component shim for MDX Preview
// provide preview-compatible versions of @theme/Tabs & @theme/TabItem

import {
  createTabs,
  type BaseTabsProps,
  type TabDefinition,
  type TabItemProps as BaseTabItemProps,
} from '../base';

// re-export types for compatibility
export type TabsProps = BaseTabsProps;
export type TabItemProps = BaseTabItemProps;
export type { TabDefinition };

// create Docusaurus-compatible tabs using the factory
// use 'mdx-preview-tabs' class prefix w/ 'docusaurus-tabs' wrapper
// support groupId for tab synchronization
const {
  Tabs,
  TabItem,
  useTabsContext,
  TabsContext,
} = createTabs({
  classPrefix: 'mdx-preview-tabs',
  wrapperClass: 'docusaurus-tabs',
  supportsGroupId: true,
  contextName: 'DocusaurusTabs',
});

export { Tabs, TabItem, useTabsContext, TabsContext };
export default Tabs;
