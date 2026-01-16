// packages/webview-app/src/components/shims/docusaurus/Tabs.tsx
// Docusaurus Tabs/TabItem component shim for MDX Preview
// Provides preview-compatible versions of @theme/Tabs & @theme/TabItem

import React, { useContext, ReactElement } from 'react';
import {
  createTabs,
  type BaseTabsProps,
  type TabDefinition,
  type TabItemProps as BaseTabItemProps,
} from '../base';

// Re-export types for compatibility
export type TabsProps = BaseTabsProps;
export type TabItemProps = BaseTabItemProps;
export type { TabDefinition };

// Create Docusaurus-compatible tabs using the factory
// Uses 'mdx-preview-tabs' class prefix with 'docusaurus-tabs' wrapper
// Supports groupId for tab synchronization
const {
  Tabs,
  useTabsContext,
  TabsContext,
} = createTabs({
  classPrefix: 'mdx-preview-tabs',
  wrapperClass: 'docusaurus-tabs',
  supportsGroupId: true,
  contextName: 'DocusaurusTabs',
});

// TabItem component (Docusaurus-specific)
// Renders children directly when outside Tabs context
export function TabItem({ children, value }: TabItemProps): ReactElement {
  const isInsideTabs = useContext(TabsContext);

  // If used outside of Tabs context, render directly
  if (!isInsideTabs) {
    return <div className="mdx-preview-tabs-item">{children}</div>;
  }

  // When inside Tabs, content is rendered by parent
  // This component is mainly for prop extraction
  return <>{children}</>;
}

export { Tabs, useTabsContext, TabsContext };
export default Tabs;
