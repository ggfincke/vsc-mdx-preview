// packages/webview-app/src/components/shims/docusaurus/Tabs.tsx
// Docusaurus Tabs/TabItem component shim for MDX Preview
// Provides preview-compatible versions of @theme/Tabs and @theme/TabItem

import React, { createContext, useContext, ReactNode, ReactElement } from 'react';
import {
  useTabState,
  type TabItemProps as BaseTabItemProps,
  type TabDefinition,
} from '../base';

// Re-export TabItemProps for compatibility
export type TabItemProps = BaseTabItemProps;

// Context for TabItem to know if it's inside Tabs
const TabsContext = createContext<boolean>(false);

// Tabs props (compatible with Docusaurus)
export interface TabsProps {
  children: ReactNode;
  defaultValue?: string;
  values?: TabDefinition[];
  groupId?: string;
  className?: string;
  queryString?: string | boolean;
  lazy?: boolean;
}

// Tabs component
export function Tabs({
  children,
  defaultValue,
  values,
  groupId,
  className,
}: TabsProps): ReactElement {
  const { activeValue, setActiveValue, tabs, tabItems } = useTabState({
    children,
    defaultValue,
    values,
  });

  return (
    <TabsContext.Provider value={true}>
      <div
        className={`docusaurus-tabs${className ? ` ${className}` : ''}`}
        data-group-id={groupId}
      >
        {/* Tab headers */}
        <div className="tabs-header" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              role="tab"
              className={`tab-button${tab.value === activeValue ? ' active' : ''}`}
              aria-selected={tab.value === activeValue}
              onClick={() => setActiveValue(tab.value)}
              tabIndex={tab.value === activeValue ? 0 : -1}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="tabs-content">
          {tabItems.map((item) => (
            <div
              key={item.value}
              role="tabpanel"
              className={`tab-panel${item.value === activeValue ? ' active' : ''}`}
              hidden={item.value !== activeValue}
            >
              {item.content}
            </div>
          ))}
        </div>
      </div>
    </TabsContext.Provider>
  );
}

// TabItem component
export function TabItem({ children, value }: TabItemProps): ReactElement {
  const isInsideTabs = useContext(TabsContext);

  // If used outside of Tabs context, render directly
  if (!isInsideTabs) {
    return <div className="tab-item">{children}</div>;
  }

  // When inside Tabs, content is rendered by parent
  // This component is mainly for prop extraction
  return <>{children}</>;
}

// Default export for compatibility
export default Tabs;
