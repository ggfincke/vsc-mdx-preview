// packages/webview-app/src/components/shims/nextra/Tabs.tsx
// Nextra Tabs component shim for MDX Preview
// provide preview-compatible version of nextra/components Tabs
// use createIndexTabs factory from BaseTabs

import { ReactNode } from 'react';
import {
  createIndexTabs,
  type IndexTabsProps,
} from '../base/BaseTabs';

// tab item can be a string or an object w/ label & other properties
export type TabItem = string | { label: string; disabled?: boolean };

// helper to get label from TabItem
function getTabLabel(item: TabItem): string {
  return typeof item === 'string' ? item : item.label;
}

// helper to check if tab is disabled
function isTabDisabled(item: TabItem): boolean {
  return typeof item === 'object' && item.disabled === true;
}

// create Nextra Tabs using factory
const { Tabs: NextraTabs, TabsContext } = createIndexTabs<TabItem>(
  {
    classPrefix: 'mdx-preview-nextra-tabs',
    contextName: 'NextraTabs',
  },
  {
    getLabel: getTabLabel,
    isDisabled: isTabDisabled,
  }
);

// re-export types for API compatibility
export type TabsProps = IndexTabsProps<TabItem>;
export interface TabProps {
  children: ReactNode;
}

// export Tab subcomponent separately for convenience
export const Tab = NextraTabs.Tab;

// export Tabs w/ compound component pattern
export const Tabs = NextraTabs;

// export context for advanced use cases
export { TabsContext };

export default Tabs;
