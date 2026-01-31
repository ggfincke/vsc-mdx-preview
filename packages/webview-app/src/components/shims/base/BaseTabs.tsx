// packages/webview-app/src/components/shims/base/BaseTabs.tsx
// Factory for creating framework-specific Tabs components w/ shared logic

import React, {
  createContext,
  useContext,
  ReactNode,
  ReactElement,
  Context,
  Children,
  isValidElement,
  HTMLAttributes,
} from 'react';
import { cn } from '../../../utils/cn';
import {
  useTabState,
  useIndexTabs,
  type TabDefinition,
  type TabItemProps,
} from './useTabState';

// Configuration for creating a Tabs component
export interface BaseTabsConfig {
  // CSS class prefix for all tab elements (e.g., 'mdx-preview-generic-tabs', 'mdx-preview-tabs')
  classPrefix: string;
  // Optional wrapper class (e.g., 'docusaurus-tabs')
  wrapperClass?: string;
  // Whether to support groupId attribute for tab synchronization
  supportsGroupId?: boolean;
  // Optional class for TabItem rendered outside Tabs context
  tabItemClassName?: string;
  // Context name for debugging
  contextName: string;
}

// Base props for all Tabs implementations
export interface BaseTabsProps {
  children: ReactNode;
  defaultValue?: string;
  values?: TabDefinition[];
  className?: string;
  // Framework-specific props (passed through if supported)
  groupId?: string;
  queryString?: string | boolean;
  lazy?: boolean;
}

// Result from createTabs factory
export interface CreateTabsResult {
  // The Tabs component
  Tabs: React.FC<BaseTabsProps>;
  // expose TabItem for framework shims
  TabItem: React.FC<TabItemProps>;
  // Hook to check if inside Tabs context
  useTabsContext: () => boolean;
  // The context itself (for advanced use cases)
  TabsContext: Context<boolean>;
}

// Factory function to create framework-specific Tabs components
// all implementations share the same core logic via useTabState hook
export function createTabs(config: BaseTabsConfig): CreateTabsResult {
  const {
    classPrefix,
    wrapperClass,
    supportsGroupId = false,
    tabItemClassName = `${classPrefix}-item`,
    contextName,
  } = config;

  // Create a unique context for this tabs implementation
  const TabsContext = createContext<boolean>(false);
  TabsContext.displayName = `${contextName}Context`;

  // The Tabs component
  function Tabs({
    children,
    defaultValue,
    values,
    className,
    groupId,
  }: BaseTabsProps): ReactElement {
    const { activeValue, setActiveValue, tabs, tabItems } = useTabState({
      children,
      defaultValue,
      values,
    });

    // Build wrapper class
    const wrapperClassName = wrapperClass
      ? `${wrapperClass}${className ? ` ${className}` : ''}`
      : `${classPrefix}${className ? ` ${className}` : ''}`;

    return (
      <TabsContext.Provider value={true}>
        <div
          className={wrapperClassName}
          data-component="tabs"
          data-group-id={supportsGroupId ? groupId : undefined}
        >
          {/* Tab headers */}
          <div className={`${classPrefix}-header`} role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                role="tab"
                className={`${classPrefix}-button${tab.value === activeValue ? ' active' : ''}`}
                aria-selected={tab.value === activeValue}
                onClick={() => setActiveValue(tab.value)}
                tabIndex={tab.value === activeValue ? 0 : -1}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className={`${classPrefix}-content`}>
            {tabItems.map((item) => (
              <div
                key={item.value}
                role="tabpanel"
                className={`${classPrefix}-panel${item.value === activeValue ? ' active' : ''}`}
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

  Tabs.displayName = contextName;

  // provide TabItem for shared props extraction
  function TabItem({ children }: TabItemProps): ReactElement {
    const isInsideTabs = useContext(TabsContext);

    // If used outside of Tabs context, render directly
    if (!isInsideTabs) {
      return <div className={tabItemClassName}>{children}</div>;
    }

    // render content via parent when inside Tabs
    return <>{children}</>;
  }

  TabItem.displayName = `${contextName}TabItem`;

  // Hook to check if inside Tabs context
  function useTabsContext(): boolean {
    return useContext(TabsContext);
  }

  return { Tabs, TabItem, useTabsContext, TabsContext };
}

// index-based Tabs factory (for Nextra-style tabs)

// Configuration for index-based tabs
export interface IndexTabsConfig {
  // CSS class prefix for all tab elements
  classPrefix: string;
  // Context name for debugging
  contextName: string;
}

// Props for index-based Tabs components
export interface IndexTabsProps<T>
  extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  children: ReactNode;
  items: T[];
  defaultIndex?: number;
  selectedIndex?: number;
  storageKey?: string;
  onChange?: (index: number) => void;
  tabClassName?: string | ((index: number, selected: boolean) => string);
}

// Item accessors for extracting label/disabled from tab items
export interface IndexTabsItemAccessors<T> {
  getLabel: (item: T) => string;
  isDisabled?: (item: T) => boolean;
}

// Result from createIndexTabs factory
export interface CreateIndexTabsResult<T> {
  Tabs: React.FC<IndexTabsProps<T>> & { Tab: React.FC<{ children: ReactNode }> };
  TabsContext: Context<boolean>;
}

// Factory for creating index-based Tabs components (Nextra style)
// uses items array instead of extracting tabs from children
export function createIndexTabs<T>(
  config: IndexTabsConfig,
  accessors: IndexTabsItemAccessors<T>
): CreateIndexTabsResult<T> {
  const { classPrefix, contextName } = config;
  const { getLabel, isDisabled = () => false } = accessors;

  const TabsContext = createContext<boolean>(false);
  TabsContext.displayName = `${contextName}Context`;

  // Tab subcomponent (compound component pattern)
  function Tab({ children }: { children: ReactNode }): ReactElement {
    return <>{children}</>;
  }

  function TabsComponent({
    children,
    items,
    defaultIndex = 0,
    selectedIndex: controlledIndex,
    storageKey,
    onChange,
    className,
    tabClassName,
    ...props
  }: IndexTabsProps<T>): ReactElement {
    const { activeIndex, setActiveIndex } = useIndexTabs({
      items,
      defaultIndex,
      controlledIndex,
      storageKey,
      onChange,
      isDisabled,
    });

    // Get Tab children for content panels
    const tabChildren = Children.toArray(children).filter(
      (child) => isValidElement(child) && child.type === Tab
    );

    return (
      <TabsContext.Provider value={true}>
        <div className={cn(classPrefix, className)} {...props}>
          <div className={`${classPrefix}-header`} role="tablist">
            {items.map((item, index) => {
              const label = getLabel(item);
              const disabled = isDisabled(item);
              const selected = index === activeIndex;

              const customClass = tabClassName
                ? typeof tabClassName === 'function'
                  ? tabClassName(index, selected)
                  : tabClassName
                : undefined;

              return (
                <button
                  key={index}
                  role="tab"
                  aria-selected={selected}
                  aria-disabled={disabled}
                  tabIndex={selected ? 0 : -1}
                  className={cn(
                    `${classPrefix}-button`,
                    selected && `${classPrefix}-button-active`,
                    disabled && `${classPrefix}-button-disabled`,
                    customClass
                  )}
                  onClick={() => setActiveIndex(index)}
                  disabled={disabled}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className={`${classPrefix}-content`}>
            {tabChildren.map((child, index) => (
              <div
                key={index}
                role="tabpanel"
                hidden={index !== activeIndex}
                className={`${classPrefix}-panel`}
              >
                {index === activeIndex && child}
              </div>
            ))}
          </div>
        </div>
      </TabsContext.Provider>
    );
  }

  const Tabs = Object.assign(TabsComponent, { Tab });
  Tabs.displayName = contextName;

  return { Tabs, TabsContext };
}

// Re-export types for convenience
export type { TabDefinition, TabItemProps };
