// packages/webview-app/src/components/shims/base/BaseTabs.tsx
// factory for creating framework-specific Tabs components w/ shared logic

import React, {
  createContext,
  useContext,
  useRef,
  useCallback,
  ReactNode,
  ReactElement,
  Context,
  Children,
  isValidElement,
  HTMLAttributes,
  KeyboardEvent,
} from 'react';
import { cn } from '../../../utils/cn';
import {
  useTabState,
  useIndexTabs,
  type TabDefinition,
  type TabItemProps,
} from './useTabState';

// configuration for creating a Tabs component
export interface BaseTabsConfig {
  classPrefix: string;
  wrapperClass?: string;
  // tab synchronization support
  supportsGroupId?: boolean;
  // standalone TabItem class
  tabItemClassName?: string;
  // debug name
  contextName: string;
}

// base props for all Tabs implementations
export interface BaseTabsProps {
  children: ReactNode;
  defaultValue?: string;
  values?: TabDefinition[];
  className?: string;
  // framework-specific pass-through
  groupId?: string;
  queryString?: string | boolean;
  lazy?: boolean;
}

// result from createTabs factory
export interface CreateTabsResult {
  Tabs: React.FC<BaseTabsProps>;
  TabItem: React.FC<TabItemProps>;
  useTabsContext: () => boolean;
  TabsContext: Context<boolean>;
}

// factory function to create framework-specific Tabs components
// all implementations share the same core logic via useTabState hook
export function createTabs(config: BaseTabsConfig): CreateTabsResult {
  const {
    classPrefix,
    wrapperClass,
    supportsGroupId = false,
    tabItemClassName = `${classPrefix}-item`,
    contextName,
  } = config;

  // create a unique context for this tabs implementation
  const TabsContext = createContext<boolean>(false);
  TabsContext.displayName = `${contextName}Context`;

  // the Tabs component
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

    // refs for tab buttons to enable focus management
    const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

    // handle keyboard navigation for tabs
    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
        const tabCount = tabs.length;
        let newIndex = currentIndex;

        switch (e.key) {
          case 'ArrowLeft':
          case 'ArrowUp':
            newIndex = (currentIndex - 1 + tabCount) % tabCount;
            break;
          case 'ArrowRight':
          case 'ArrowDown':
            newIndex = (currentIndex + 1) % tabCount;
            break;
          case 'Home':
            newIndex = 0;
            break;
          case 'End':
            newIndex = tabCount - 1;
            break;
          default:
            return;
        }

        e.preventDefault();
        setActiveValue(tabs[newIndex].value);
        tabRefs.current[newIndex]?.focus();
      },
      [tabs, setActiveValue]
    );

    // build wrapper class
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
          {/* tab headers */}
          <div className={`${classPrefix}-header`} role="tablist">
            {tabs.map((tab, index) => (
              <button
                key={tab.value}
                ref={(el) => {
                  tabRefs.current[index] = el;
                }}
                role="tab"
                className={`${classPrefix}-button${tab.value === activeValue ? ' active' : ''}`}
                aria-selected={tab.value === activeValue}
                onClick={() => setActiveValue(tab.value)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                tabIndex={tab.value === activeValue ? 0 : -1}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* tab content */}
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

    // if used outside of Tabs context, render directly
    if (!isInsideTabs) {
      return <div className={tabItemClassName}>{children}</div>;
    }

    // render content via parent when inside Tabs
    return <>{children}</>;
  }

  TabItem.displayName = `${contextName}TabItem`;

  // hook to check if inside Tabs context
  function useTabsContext(): boolean {
    return useContext(TabsContext);
  }

  return { Tabs, TabItem, useTabsContext, TabsContext };
}

// index-based Tabs factory (for Nextra-style tabs)

// configuration for index-based tabs
export interface IndexTabsConfig {
  classPrefix: string;
  // debug name
  contextName: string;
}

// props for index-based Tabs components
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

// item accessors for index-based tabs
export interface IndexTabsItemAccessors<T> {
  getLabel: (item: T) => string;
  isDisabled?: (item: T) => boolean;
}

// result from createIndexTabs factory
export interface CreateIndexTabsResult<T> {
  Tabs: React.FC<IndexTabsProps<T>> & { Tab: React.FC<{ children: ReactNode }> };
  TabsContext: Context<boolean>;
}

// factory for creating index-based Tabs components (Nextra style)
// uses items array instead of extracting tabs from children
export function createIndexTabs<T>(
  config: IndexTabsConfig,
  accessors: IndexTabsItemAccessors<T>
): CreateIndexTabsResult<T> {
  const { classPrefix, contextName } = config;
  const { getLabel, isDisabled = () => false } = accessors;

  const TabsContext = createContext<boolean>(false);
  TabsContext.displayName = `${contextName}Context`;

  // tab subcomponent (compound component pattern)
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

    // refs for tab buttons to enable focus management
    const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

    // handle keyboard navigation for tabs
    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
        const tabCount = items.length;
        let newIndex = currentIndex;

        switch (e.key) {
          case 'ArrowLeft':
          case 'ArrowUp':
            // find previous non-disabled tab
            for (let i = 1; i <= tabCount; i++) {
              const idx = (currentIndex - i + tabCount) % tabCount;
              if (!isDisabled(items[idx])) {
                newIndex = idx;
                break;
              }
            }
            break;
          case 'ArrowRight':
          case 'ArrowDown':
            // find next non-disabled tab
            for (let i = 1; i <= tabCount; i++) {
              const idx = (currentIndex + i) % tabCount;
              if (!isDisabled(items[idx])) {
                newIndex = idx;
                break;
              }
            }
            break;
          case 'Home':
            // find first non-disabled tab
            for (let i = 0; i < tabCount; i++) {
              if (!isDisabled(items[i])) {
                newIndex = i;
                break;
              }
            }
            break;
          case 'End':
            // find last non-disabled tab
            for (let i = tabCount - 1; i >= 0; i--) {
              if (!isDisabled(items[i])) {
                newIndex = i;
                break;
              }
            }
            break;
          default:
            return;
        }

        e.preventDefault();
        setActiveIndex(newIndex);
        tabRefs.current[newIndex]?.focus();
      },
      [items, setActiveIndex]
    );

    // get Tab children for content panels
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
                  ref={(el) => {
                    tabRefs.current[index] = el;
                  }}
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
                  onKeyDown={(e) => handleKeyDown(e, index)}
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

// re-export types for convenience
export type { TabDefinition, TabItemProps };
