// packages/webview-app/src/components/shims/generic/TabItem.tsx
// Generic TabItem component shim for MDX Preview
// provides preview-compatible tab item without framework dependency

import React, { ReactElement } from 'react';
import { type TabItemProps } from '../base';
import { useGenericTabsContext } from './Tabs';

// TabItem component
export function TabItem({ children }: TabItemProps): ReactElement {
  const isInsideTabs = useGenericTabsContext();

  // If used outside of Tabs context, render directly
  if (!isInsideTabs) {
    return <div className="mdx-preview-generic-tab-item">{children}</div>;
  }

  // When inside Tabs, content is rendered by parent
  // This component is mainly for prop extraction
  return <>{children}</>;
}

// Tab component (alias for TabItem)
export function Tab(props: TabItemProps): ReactElement {
  return <TabItem {...props} />;
}

export default TabItem;
