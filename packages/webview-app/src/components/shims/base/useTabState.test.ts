// Tests for useTabState hook

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { useTabState, extractTabItems, type TabItemProps } from './useTabState';

// Helper to create mock TabItem elements
function createTabItem(props: TabItemProps): React.ReactElement {
  return React.createElement('div', { ...props, key: props.value });
}

describe('extractTabItems', () => {
  it('extracts tab items from valid TabItem children', () => {
    const children = [
      createTabItem({
        value: 'js',
        label: 'JavaScript',
        children: 'JS content',
      }),
      createTabItem({
        value: 'ts',
        label: 'TypeScript',
        children: 'TS content',
      }),
    ];

    const result = extractTabItems(children);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      value: 'js',
      label: 'JavaScript',
      content: 'JS content',
    });
    expect(result[1]).toEqual({
      value: 'ts',
      label: 'TypeScript',
      content: 'TS content',
    });
  });

  it('uses value as label when label not provided', () => {
    const children = [createTabItem({ value: 'myValue', children: 'Content' })];

    const result = extractTabItems(children);

    expect(result[0].label).toBe('myValue');
  });

  it('handles empty children', () => {
    const result = extractTabItems(null);
    expect(result).toHaveLength(0);
  });

  it('skips non-element children', () => {
    const children = [
      'string child',
      123,
      createTabItem({ value: 'valid', children: 'Content' }),
    ];

    const result = extractTabItems(children);

    expect(result).toHaveLength(1);
    expect(result[0].value).toBe('valid');
  });

  it('skips elements without value prop', () => {
    const children = [
      React.createElement('div', { key: 'no-value', children: 'No value' }),
      createTabItem({ value: 'has-value', children: 'Has value' }),
    ];

    const result = extractTabItems(children);

    expect(result).toHaveLength(1);
    expect(result[0].value).toBe('has-value');
  });
});

describe('useTabState', () => {
  it('extracts tab items from children', () => {
    const children = [
      createTabItem({ value: 'one', label: 'One', children: 'Content 1' }),
      createTabItem({ value: 'two', label: 'Two', children: 'Content 2' }),
    ];

    const { result } = renderHook(() => useTabState({ children }));

    expect(result.current.tabItems).toHaveLength(2);
    expect(result.current.tabs).toHaveLength(2);
  });

  it('determines initial value from defaultValue prop', () => {
    const children = [
      createTabItem({ value: 'first', children: 'First' }),
      createTabItem({ value: 'second', children: 'Second' }),
    ];

    const { result } = renderHook(() =>
      useTabState({ children, defaultValue: 'second' })
    );

    expect(result.current.activeValue).toBe('second');
  });

  it('determines initial value from default prop on TabItem', () => {
    const children = [
      createTabItem({ value: 'first', children: 'First' }),
      createTabItem({ value: 'second', default: true, children: 'Second' }),
    ];

    const { result } = renderHook(() => useTabState({ children }));

    expect(result.current.activeValue).toBe('second');
  });

  it('falls back to first tab when no default specified', () => {
    const children = [
      createTabItem({ value: 'first', children: 'First' }),
      createTabItem({ value: 'second', children: 'Second' }),
    ];

    const { result } = renderHook(() => useTabState({ children }));

    expect(result.current.activeValue).toBe('first');
  });

  it('validates activeValue against available tabs', () => {
    const children = [createTabItem({ value: 'valid', children: 'Valid' })];

    const { result } = renderHook(() =>
      useTabState({ children, defaultValue: 'nonexistent' })
    );

    // Should fall back to first tab since 'nonexistent' is invalid
    expect(result.current.activeValue).toBe('valid');
  });

  it('handles empty children', () => {
    const { result } = renderHook(() => useTabState({ children: null }));

    expect(result.current.tabItems).toHaveLength(0);
    expect(result.current.tabs).toHaveLength(0);
    expect(result.current.activeValue).toBe('');
  });

  it('uses values prop over extracted values', () => {
    const children = [
      createTabItem({ value: 'a', label: 'Label A', children: 'A' }),
      createTabItem({ value: 'b', label: 'Label B', children: 'B' }),
    ];
    const values = [
      { value: 'a', label: 'Override A' },
      { value: 'b', label: 'Override B' },
    ];

    const { result } = renderHook(() => useTabState({ children, values }));

    expect(result.current.tabs[0].label).toBe('Override A');
    expect(result.current.tabs[1].label).toBe('Override B');
  });

  it('allows changing active value', () => {
    const children = [
      createTabItem({ value: 'first', children: 'First' }),
      createTabItem({ value: 'second', children: 'Second' }),
    ];

    const { result } = renderHook(() => useTabState({ children }));

    expect(result.current.activeValue).toBe('first');

    act(() => {
      result.current.setActiveValue('second');
    });

    expect(result.current.activeValue).toBe('second');
  });

  it('handles non-TabItem children gracefully', () => {
    const children = [
      React.createElement('span', { key: 'text' }, 'Just text'),
      createTabItem({ value: 'tab', children: 'Tab content' }),
    ];

    const { result } = renderHook(() => useTabState({ children }));

    expect(result.current.tabItems).toHaveLength(1);
    expect(result.current.tabItems[0].value).toBe('tab');
  });
});
