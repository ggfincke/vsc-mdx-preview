// packages/webview-app/src/components/shims/generic/Tabs.tsx
// Generic Tabs component shim for MDX Preview
// provides preview-compatible tabs without framework dependency

import React, { createContext, useContext, ReactNode, ReactElement } from 'react';
import {
  useTabState,
  type TabItemProps as BaseTabItemProps,
  type TabDefinition,
} from '../base';

// Re-export TabItemProps for compatibility
export type TabItemProps = BaseTabItemProps;

// context for TabItem to know if it's inside Tabs
const GenericTabsContext = createContext<boolean>(false);

// Tabs props
export interface TabsProps {
  children: ReactNode;
  defaultValue?: string;
  values?: TabDefinition[];
  className?: string;
}

// Generic Tabs component
export function Tabs({
  children,
  defaultValue,
  values,
  className,
}: TabsProps): ReactElement {
  const { activeValue, setActiveValue, tabs, tabItems } = useTabState({
    children,
    defaultValue,
    values,
  });

  return (
    <GenericTabsContext.Provider value={true}>
      <div className={`mdx-preview-generic-tabs${className ? ` ${className}` : ''}`}>
        {/* Tab headers */}
        <div className="mdx-preview-generic-tabs-header" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              role="tab"
              className={`mdx-preview-generic-tabs-button${tab.value === activeValue ? ' active' : ''}`}
              aria-selected={tab.value === activeValue}
              onClick={() => setActiveValue(tab.value)}
              tabIndex={tab.value === activeValue ? 0 : -1}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="mdx-preview-generic-tabs-content">
          {tabItems.map((item) => (
            <div
              key={item.value}
              role="tabpanel"
              className={`mdx-preview-generic-tabs-panel${item.value === activeValue ? ' active' : ''}`}
              hidden={item.value !== activeValue}
            >
              {item.content}
            </div>
          ))}
        </div>
      </div>
    </GenericTabsContext.Provider>
  );
}

// check if inside Tabs context
export function useGenericTabsContext(): boolean {
  return useContext(GenericTabsContext);
}

export default Tabs;
