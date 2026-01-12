// packages/webview-app/src/components/shims/base/useTabState.ts
// shared hook for tab state management across framework shims

import { useState, ReactNode, isValidElement, Children } from 'react';

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

// Props for a TabItem component
export interface TabItemProps {
  children: ReactNode;
  value: string;
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
    if (props.value !== undefined) {
      items.push({
        value: props.value,
        label: props.label || props.value,
        content: props.children,
      });
    }
  });

  return items;
}

// finds the default tab value from children
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
// extracts tab items from children, determines initial active value,
// & provides state management for tab selection.
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
