// packages/webview-app/src/components/shims/nextra/Tabs.test.tsx
// Tests for Nextra Tabs component shim

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Tabs } from './Tabs';

describe('Nextra Tabs', () => {
  // Mock localStorage
  const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: vi.fn((key: string) => store[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      clear: () => {
        store = {};
      },
    };
  })();

  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('renders tab buttons from items prop', () => {
      render(
        <Tabs items={['pnpm', 'npm', 'yarn']}>
          <Tabs.Tab>pnpm content</Tabs.Tab>
          <Tabs.Tab>npm content</Tabs.Tab>
          <Tabs.Tab>yarn content</Tabs.Tab>
        </Tabs>
      );
      expect(screen.getByRole('tab', { name: 'pnpm' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'npm' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'yarn' })).toBeInTheDocument();
    });

    it('renders active tab content', () => {
      render(
        <Tabs items={['Tab 1', 'Tab 2']}>
          <Tabs.Tab>Content 1</Tabs.Tab>
          <Tabs.Tab>Content 2</Tabs.Tab>
        </Tabs>
      );
      expect(screen.getByText('Content 1')).toBeInTheDocument();
      expect(screen.queryByText('Content 2')).not.toBeInTheDocument();
    });

    it('applies base CSS classes', () => {
      const { container } = render(
        <Tabs items={['Tab 1']}>
          <Tabs.Tab>Content</Tabs.Tab>
        </Tabs>
      );
      expect(
        container.querySelector('.mdx-preview-nextra-tabs')
      ).toBeInTheDocument();
      expect(
        container.querySelector('.mdx-preview-nextra-tabs-header')
      ).toBeInTheDocument();
      expect(
        container.querySelector('.mdx-preview-nextra-tabs-content')
      ).toBeInTheDocument();
    });
  });

  describe('tab selection', () => {
    it('switches tab on click', () => {
      render(
        <Tabs items={['Tab 1', 'Tab 2']}>
          <Tabs.Tab>Content 1</Tabs.Tab>
          <Tabs.Tab>Content 2</Tabs.Tab>
        </Tabs>
      );

      // Initial state
      expect(screen.getByText('Content 1')).toBeInTheDocument();

      // Click second tab
      fireEvent.click(screen.getByRole('tab', { name: 'Tab 2' }));
      expect(screen.queryByText('Content 1')).not.toBeInTheDocument();
      expect(screen.getByText('Content 2')).toBeInTheDocument();
    });

    it('respects defaultIndex prop', () => {
      render(
        <Tabs items={['Tab 1', 'Tab 2', 'Tab 3']} defaultIndex={1}>
          <Tabs.Tab>Content 1</Tabs.Tab>
          <Tabs.Tab>Content 2</Tabs.Tab>
          <Tabs.Tab>Content 3</Tabs.Tab>
        </Tabs>
      );
      expect(screen.getByText('Content 2')).toBeInTheDocument();
      expect(screen.queryByText('Content 1')).not.toBeInTheDocument();
    });

    it('calls onChange callback when tab changes', () => {
      const handleChange = vi.fn();
      render(
        <Tabs items={['Tab 1', 'Tab 2']} onChange={handleChange}>
          <Tabs.Tab>Content 1</Tabs.Tab>
          <Tabs.Tab>Content 2</Tabs.Tab>
        </Tabs>
      );

      fireEvent.click(screen.getByRole('tab', { name: 'Tab 2' }));
      expect(handleChange).toHaveBeenCalledWith(1);
    });
  });

  describe('controlled mode', () => {
    it('uses selectedIndex when provided', () => {
      render(
        <Tabs items={['Tab 1', 'Tab 2']} selectedIndex={1}>
          <Tabs.Tab>Content 1</Tabs.Tab>
          <Tabs.Tab>Content 2</Tabs.Tab>
        </Tabs>
      );
      expect(screen.getByText('Content 2')).toBeInTheDocument();
    });

    it('selectedIndex overrides defaultIndex', () => {
      render(
        <Tabs items={['Tab 1', 'Tab 2', 'Tab 3']} defaultIndex={0} selectedIndex={2}>
          <Tabs.Tab>Content 1</Tabs.Tab>
          <Tabs.Tab>Content 2</Tabs.Tab>
          <Tabs.Tab>Content 3</Tabs.Tab>
        </Tabs>
      );
      expect(screen.getByText('Content 3')).toBeInTheDocument();
    });
  });

  describe('disabled tabs', () => {
    it('renders disabled tab with correct class', () => {
      const { container } = render(
        <Tabs items={[{ label: 'Tab 1', disabled: false }, { label: 'Tab 2', disabled: true }]}>
          <Tabs.Tab>Content 1</Tabs.Tab>
          <Tabs.Tab>Content 2</Tabs.Tab>
        </Tabs>
      );
      const disabledTab = screen.getByRole('tab', { name: 'Tab 2' });
      expect(disabledTab).toBeDisabled();
      expect(disabledTab).toHaveClass('mdx-preview-nextra-tab-button-disabled');
    });

    it('does not switch to disabled tab on click', () => {
      render(
        <Tabs items={[{ label: 'Tab 1' }, { label: 'Tab 2', disabled: true }]}>
          <Tabs.Tab>Content 1</Tabs.Tab>
          <Tabs.Tab>Content 2</Tabs.Tab>
        </Tabs>
      );

      fireEvent.click(screen.getByRole('tab', { name: 'Tab 2' }));
      // Should still show Content 1
      expect(screen.getByText('Content 1')).toBeInTheDocument();
    });
  });

  describe('active tab styling', () => {
    it('applies active class to selected tab', () => {
      render(
        <Tabs items={['Tab 1', 'Tab 2']}>
          <Tabs.Tab>Content 1</Tabs.Tab>
          <Tabs.Tab>Content 2</Tabs.Tab>
        </Tabs>
      );
      const activeTab = screen.getByRole('tab', { name: 'Tab 1' });
      expect(activeTab).toHaveClass('mdx-preview-nextra-tab-button-active');
      expect(activeTab).toHaveAttribute('aria-selected', 'true');
    });

    it('moves active class when tab changes', () => {
      render(
        <Tabs items={['Tab 1', 'Tab 2']}>
          <Tabs.Tab>Content 1</Tabs.Tab>
          <Tabs.Tab>Content 2</Tabs.Tab>
        </Tabs>
      );

      fireEvent.click(screen.getByRole('tab', { name: 'Tab 2' }));

      const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
      const tab2 = screen.getByRole('tab', { name: 'Tab 2' });

      expect(tab1).not.toHaveClass('mdx-preview-nextra-tab-button-active');
      expect(tab2).toHaveClass('mdx-preview-nextra-tab-button-active');
    });
  });

  describe('localStorage persistence', () => {
    it('saves selection to localStorage when storageKey is provided', () => {
      render(
        <Tabs items={['Tab 1', 'Tab 2']} storageKey="test-tabs">
          <Tabs.Tab>Content 1</Tabs.Tab>
          <Tabs.Tab>Content 2</Tabs.Tab>
        </Tabs>
      );

      fireEvent.click(screen.getByRole('tab', { name: 'Tab 2' }));
      expect(localStorageMock.setItem).toHaveBeenCalledWith('nextra-tabs-test-tabs', '1');
    });

    it('restores selection from localStorage', () => {
      localStorageMock.getItem.mockReturnValue('1');

      render(
        <Tabs items={['Tab 1', 'Tab 2']} storageKey="test-tabs">
          <Tabs.Tab>Content 1</Tabs.Tab>
          <Tabs.Tab>Content 2</Tabs.Tab>
        </Tabs>
      );

      expect(screen.getByText('Content 2')).toBeInTheDocument();
    });
  });

  describe('tabClassName', () => {
    it('applies string tabClassName to all tabs', () => {
      render(
        <Tabs items={['Tab 1', 'Tab 2']} tabClassName="custom-tab">
          <Tabs.Tab>Content 1</Tabs.Tab>
          <Tabs.Tab>Content 2</Tabs.Tab>
        </Tabs>
      );

      const tabs = screen.getAllByRole('tab');
      tabs.forEach((tab) => {
        expect(tab).toHaveClass('custom-tab');
      });
    });

    it('applies function tabClassName with index and selected', () => {
      render(
        <Tabs
          items={['Tab 1', 'Tab 2']}
          tabClassName={(index, selected) => (selected ? 'is-selected' : `tab-${index}`)}
        >
          <Tabs.Tab>Content 1</Tabs.Tab>
          <Tabs.Tab>Content 2</Tabs.Tab>
        </Tabs>
      );

      expect(screen.getByRole('tab', { name: 'Tab 1' })).toHaveClass('is-selected');
      expect(screen.getByRole('tab', { name: 'Tab 2' })).toHaveClass('tab-1');
    });
  });

  describe('accessibility', () => {
    it('has correct ARIA attributes', () => {
      const { container } = render(
        <Tabs items={['Tab 1', 'Tab 2']}>
          <Tabs.Tab>Content 1</Tabs.Tab>
          <Tabs.Tab>Content 2</Tabs.Tab>
        </Tabs>
      );

      // Tablist
      expect(container.querySelector('[role="tablist"]')).toBeInTheDocument();

      // Tabs
      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');

      // Tab panels
      const panels = container.querySelectorAll('[role="tabpanel"]');
      expect(panels).toHaveLength(2);
    });

    it('inactive tab has tabIndex -1', () => {
      render(
        <Tabs items={['Tab 1', 'Tab 2']}>
          <Tabs.Tab>Content 1</Tabs.Tab>
          <Tabs.Tab>Content 2</Tabs.Tab>
        </Tabs>
      );

      expect(screen.getByRole('tab', { name: 'Tab 1' })).toHaveAttribute('tabIndex', '0');
      expect(screen.getByRole('tab', { name: 'Tab 2' })).toHaveAttribute('tabIndex', '-1');
    });
  });

  describe('compound component', () => {
    it('Tabs.Tab is accessible as static property', () => {
      expect(Tabs.Tab).toBeDefined();
      expect(typeof Tabs.Tab).toBe('function');
    });
  });
});
