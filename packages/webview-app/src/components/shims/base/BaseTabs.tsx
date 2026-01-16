// packages/webview-app/src/components/shims/base/BaseTabs.tsx
// Factory for creating framework-specific Tabs components with shared logic

import React, {
  createContext,
  useContext,
  ReactNode,
  ReactElement,
  Context,
} from 'react';
import { useTabState, type TabDefinition, type TabItemProps } from './useTabState';

// Configuration for creating a Tabs component
export interface BaseTabsConfig {
  // CSS class prefix for all tab elements (e.g., 'mdx-preview-generic-tabs', 'mdx-preview-tabs')
  classPrefix: string;
  // Optional wrapper class (e.g., 'docusaurus-tabs')
  wrapperClass?: string;
  // Whether to support groupId attribute for tab synchronization
  supportsGroupId?: boolean;
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
  // Hook to check if inside Tabs context
  useTabsContext: () => boolean;
  // The context itself (for advanced use cases)
  TabsContext: Context<boolean>;
}

/**
 * Factory function to create framework-specific Tabs components.
 * All implementations share the same core logic via useTabState hook.
 *
 * @example
 * ```tsx
 * // Create generic tabs
 * const { Tabs, useTabsContext } = createTabs({
 *   classPrefix: 'mdx-preview-generic-tabs',
 *   contextName: 'GenericTabs',
 * });
 *
 * // Create Docusaurus-compatible tabs
 * const { Tabs, useTabsContext } = createTabs({
 *   classPrefix: 'mdx-preview-tabs',
 *   wrapperClass: 'docusaurus-tabs',
 *   supportsGroupId: true,
 *   contextName: 'DocusaurusTabs',
 * });
 * ```
 */
export function createTabs(config: BaseTabsConfig): CreateTabsResult {
  const { classPrefix, wrapperClass, supportsGroupId = false, contextName } = config;

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

  // Hook to check if inside Tabs context
  function useTabsContext(): boolean {
    return useContext(TabsContext);
  }

  return { Tabs, useTabsContext, TabsContext };
}

// Re-export types for convenience
export type { TabDefinition, TabItemProps };
