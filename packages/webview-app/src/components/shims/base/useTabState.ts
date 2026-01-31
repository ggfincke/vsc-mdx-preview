// packages/webview-app/src/components/shims/base/useTabState.ts
// shared hook for tab state management across framework shims

import {
  useState,
  useCallback,
  ReactNode,
  isValidElement,
  Children,
} from 'react';

// Tab item extracted from children
export interface TabItem {
  value: string;
  label: string;
  content: ReactNode;
}

// Tab definition (value & label only)
export interface TabDefinition {
  value: string;
  label: string;
}

// props for a TabItem component
export interface TabItemProps {
  children: ReactNode;
  // optional - can use label as fallback (Starlight uses label only)
  value?: string;
  label?: string;
  default?: boolean;
}

// Options for useTabState hook
export interface UseTabStateOptions {
  children: ReactNode;
  defaultValue?: string;
  values?: TabDefinition[];
}

// Result from useTabState hook
export interface UseTabStateResult {
  activeValue: string;
  setActiveValue: (value: string) => void;
  tabs: TabDefinition[];
  tabItems: TabItem[];
}

// extracts TabItem children w/ their props
export function extractTabItems(children: ReactNode): TabItem[] {
  const items: TabItem[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) {
      return;
    }

    const props = child.props as TabItemProps;
    // Accept either 'value' (Docusaurus) or 'label' (Starlight) as identifier
    const value = props.value ?? props.label;
    if (value !== undefined) {
      items.push({
        value,
        label: props.label || value,
        content: props.children,
      });
    }
  });

  return items;
}

// find default tab value from children
function findDefaultFromChildren(
  children: ReactNode,
  tabItems: TabItem[]
): string | undefined {
  const childArray = Children.toArray(children);

  for (const item of tabItems) {
    const child = childArray.find(
      (c) => isValidElement(c) && (c.props as TabItemProps).value === item.value
    );
    if (
      child &&
      isValidElement(child) &&
      (child.props as TabItemProps).default
    ) {
      return item.value;
    }
  }

  return undefined;
}

// hook for managing tab state
// extracts tab items from children, determines initial active value
// & provides state management for tab selection
export function useTabState(options: UseTabStateOptions): UseTabStateResult {
  const { children, defaultValue, values } = options;

  // Extract tab items from children
  const tabItems = extractTabItems(children);

  // Use provided values or extracted ones
  const tabs: TabDefinition[] =
    values ||
    tabItems.map((item) => ({
      value: item.value,
      label: item.label,
    }));

  // Determine initial active value
  const initialValue =
    defaultValue ||
    findDefaultFromChildren(children, tabItems) ||
    tabs[0]?.value ||
    '';

  const [activeValue, setActiveValue] = useState(initialValue);

  // Ensure activeValue is valid (in case tabs change)
  const validActiveValue = tabs.find((t) => t.value === activeValue)
    ? activeValue
    : tabs[0]?.value || '';

  return {
    activeValue: validActiveValue,
    setActiveValue,
    tabs,
    tabItems,
  };
}

export default useTabState;

// index-based tab state management (for Nextra-style tabs)

// options for useIndexTabs hook (used by components w/ index-based tab selection)
export interface UseIndexTabsOptions<T> {
  // array of tab items
  items: T[];
  // default selected index (default: 0)
  defaultIndex?: number;
  // controlled selected index (overrides internal state)
  controlledIndex?: number;
  // localStorage key for persisting selected tab
  storageKey?: string;
  // callback when tab selection changes
  onChange?: (index: number) => void;
  // function to check if a tab item is disabled
  isDisabled?: (item: T, index: number) => boolean;
}

// result from useIndexTabs hook
export interface UseIndexTabsResult {
  // currently active tab index
  activeIndex: number;
  // function to set active tab index (handles disabled check, localStorage, onChange)
  setActiveIndex: (index: number) => void;
}

// hook for index-based tab state management
export function useIndexTabs<T>({
  items,
  defaultIndex = 0,
  controlledIndex,
  storageKey,
  onChange,
  isDisabled = () => false,
}: UseIndexTabsOptions<T>): UseIndexTabsResult {
  // get initial index from localStorage if storageKey is provided
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
  const setActiveIndex = useCallback(
    (index: number) => {
      // Check if tab is disabled
      if (items[index] !== undefined && isDisabled(items[index], index)) {
        return;
      }

      // Update internal state if not controlled
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

      // Call onChange callback
      onChange?.(index);
    },
    [controlledIndex, items, isDisabled, onChange, storageKey]
  );

  return { activeIndex, setActiveIndex };
}
