// packages/webview-app/src/components/shims/nextra/Tabs.tsx
// Nextra Tabs component shim for MDX Preview
// Provides preview-compatible version of nextra/components Tabs
// Uses compound component pattern: Tabs and Tabs.Tab

import React, {
  ReactNode,
  ReactElement,
  HTMLAttributes,
  useState,
  useCallback,
  Children,
  isValidElement,
} from 'react';

// Tab item can be a string or an object with label and other properties
export type TabItem = string | { label: string; disabled?: boolean };

// Tabs props (compatible with Nextra)
export interface TabsProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  children: ReactNode;
  items: TabItem[];
  defaultIndex?: number;
  selectedIndex?: number;
  storageKey?: string;
  onChange?: (index: number) => void;
  tabClassName?: string | ((index: number, selected: boolean) => string);
}

// Tab props (for Tabs.Tab subcomponent)
export interface TabProps {
  children: ReactNode;
}

// Helper to get label from TabItem
function getTabLabel(item: TabItem): string {
  return typeof item === 'string' ? item : item.label;
}

// Helper to check if tab is disabled
function isTabDisabled(item: TabItem): boolean {
  return typeof item === 'object' && item.disabled === true;
}

// Main Tabs component
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
}: TabsProps): ReactElement {
  // Get initial index from localStorage if storageKey is provided
  const getInitialIndex = useCallback((): number => {
    if (storageKey && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`nextra-tabs-${storageKey}`);
        if (stored !== null) {
          const parsed = parseInt(stored, 10);
          if (!isNaN(parsed) && parsed >= 0 && parsed < items.length) {
            return parsed;
          }
        }
      } catch {
        // Ignore localStorage errors
      }
    }
    return defaultIndex;
  }, [storageKey, defaultIndex, items.length]);

  const [internalIndex, setInternalIndex] = useState(getInitialIndex);
  const activeIndex = controlledIndex ?? internalIndex;

  // Handle tab selection
  const handleTabClick = useCallback(
    (index: number) => {
      if (isTabDisabled(items[index])) {return;}

      if (controlledIndex === undefined) {
        setInternalIndex(index);
      }

      // Save to localStorage if storageKey is provided
      if (storageKey && typeof window !== 'undefined') {
        try {
          localStorage.setItem(`nextra-tabs-${storageKey}`, String(index));
        } catch {
          // Ignore localStorage errors
        }
      }

      onChange?.(index);
    },
    [controlledIndex, items, onChange, storageKey]
  );

  // Get tab children
  const tabChildren = Children.toArray(children).filter(
    (child) => isValidElement(child) && child.type === Tab
  );

  // Build class names
  const classes = ['mdx-preview-nextra-tabs', className].filter(Boolean).join(' ');

  return (
    <div className={classes} {...props}>
      <div className="mdx-preview-nextra-tabs-header" role="tablist">
        {items.map((item, index) => {
          const label = getTabLabel(item);
          const disabled = isTabDisabled(item);
          const selected = index === activeIndex;

          // Compute tab class
          let tabClass = 'mdx-preview-nextra-tab-button';
          if (selected) {tabClass += ' mdx-preview-nextra-tab-button-active';}
          if (disabled) {tabClass += ' mdx-preview-nextra-tab-button-disabled';}
          if (tabClassName) {
            const customClass =
              typeof tabClassName === 'function'
                ? tabClassName(index, selected)
                : tabClassName;
            tabClass += ` ${customClass}`;
          }

          return (
            <button
              key={index}
              role="tab"
              aria-selected={selected}
              aria-disabled={disabled}
              tabIndex={selected ? 0 : -1}
              className={tabClass}
              onClick={() => handleTabClick(index)}
              disabled={disabled}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="mdx-preview-nextra-tabs-content">
        {tabChildren.map((child, index) => (
          <div
            key={index}
            role="tabpanel"
            hidden={index !== activeIndex}
            className="mdx-preview-nextra-tab-panel"
          >
            {index === activeIndex && child}
          </div>
        ))}
      </div>
    </div>
  );
}

// Tab subcomponent (Tabs.Tab)
function Tab({ children }: TabProps): ReactElement {
  return <>{children}</>;
}

// Attach Tab as static property on Tabs (compound component pattern)
export const Tabs = Object.assign(TabsComponent, { Tab });

export default Tabs;
