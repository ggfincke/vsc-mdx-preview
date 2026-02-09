// packages/webview-app/src/components/shims/base/useTabState.ts
// shared hook for tab state management across framework shims

import {
  useState,
  useCallback,
  ReactNode,
  isValidElement,
  Children,
} from 'react';

// tab item extracted from children
export interface TabItem {
  value: string;
  label: string;
  content: ReactNode;
}

// tab definition (value & label only)
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

// options for useTabState hook
export interface UseTabStateOptions {
  children: ReactNode;
  defaultValue?: string;
  values?: TabDefinition[];
}

// result from useTabState hook
export interface UseTabStateResult {
  activeValue: string;
  setActiveValue: (value: string) => void;
  tabs: TabDefinition[];
  tabItems: TabItem[];
}

// extract TabItem children w/ their props
export function extractTabItems(children: ReactNode): TabItem[] {
  const items: TabItem[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) {
      return;
    }

    const props = child.props as TabItemProps;
    // accept either 'value' (Docusaurus) or 'label' (Starlight) as identifier
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
// extract tab items from children, determine initial active value
// & provide state management for tab selection
export function useTabState(options: UseTabStateOptions): UseTabStateResult {
  const { children, defaultValue, values } = options;

  // extract tab items from children
  const tabItems = extractTabItems(children);

  // use provided values or extracted ones
  const tabs: TabDefinition[] =
    values ||
    tabItems.map((item) => ({
      value: item.value,
      label: item.label,
    }));

  // determine initial active value
  const initialValue =
    defaultValue ||
    findDefaultFromChildren(children, tabItems) ||
    tabs[0]?.value ||
    '';

  const [activeValue, setActiveValue] = useState(initialValue);

  // ensure activeValue is valid (in case tabs change)
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

// options for useIndexTabs hook
export interface UseIndexTabsOptions<T> {
  items: T[];
  defaultIndex?: number;
  // overrides internal state
  controlledIndex?: number;
  // localStorage persistence key
  storageKey?: string;
  // selection change handler
  onChange?: (index: number) => void;
  // disabled check
  isDisabled?: (item: T, index: number) => boolean;
}

// result from useIndexTabs hook
export interface UseIndexTabsResult {
  activeIndex: number;
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
        // ignore localStorage errors
      }
    }
    return defaultIndex;
  }, [storageKey, defaultIndex, items.length]);

  const [internalIndex, setInternalIndex] = useState(getInitialIndex);
  const activeIndex = controlledIndex ?? internalIndex;

  // handle tab selection
  const setActiveIndex = useCallback(
    (index: number) => {
      // check if tab is disabled
      if (items[index] !== undefined && isDisabled(items[index], index)) {
        return;
      }

      // update internal state if not controlled
      if (controlledIndex === undefined) {
        setInternalIndex(index);
      }

      // save to localStorage if storageKey is provided
      if (storageKey && typeof window !== 'undefined') {
        try {
          localStorage.setItem(`nextra-tabs-${storageKey}`, String(index));
        } catch {
          // ignore localStorage errors
        }
      }

      // call onChange callback
      onChange?.(index);
    },
    [controlledIndex, items, isDisabled, onChange, storageKey]
  );

  return { activeIndex, setActiveIndex };
}
