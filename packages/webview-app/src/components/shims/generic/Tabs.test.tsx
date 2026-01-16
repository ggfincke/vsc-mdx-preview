// packages/webview-app/src/components/shims/generic/Tabs.test.tsx
// Tests for generic Tabs component created via createTabs factory

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Tabs, useGenericTabsContext, GenericTabsContext } from './Tabs';
import { useContext } from 'react';

// Helper component for testing TabItem behavior
function TabItem({
  children,
  value,
  label,
  default: isDefault,
}: {
  children: React.ReactNode;
  value: string;
  label?: string;
  default?: boolean;
}) {
  return <>{children}</>;
}

describe('Tabs', () => {
  describe('rendering', () => {
    it('renders children content', () => {
      render(
        <Tabs>
          <TabItem value="tab1">Tab 1 content</TabItem>
        </Tabs>
      );
      expect(screen.getByText('Tab 1 content')).toBeInTheDocument();
    });

    it('renders with base CSS class', () => {
      const { container } = render(
        <Tabs>
          <TabItem value="tab1">Content</TabItem>
        </Tabs>
      );
      expect(
        container.querySelector('.mdx-preview-generic-tabs')
      ).toBeInTheDocument();
    });

    it('renders tab header with tablist role', () => {
      const { container } = render(
        <Tabs>
          <TabItem value="tab1">Content</TabItem>
        </Tabs>
      );
      expect(container.querySelector('[role="tablist"]')).toBeInTheDocument();
    });

    it('renders tab buttons for each tab', () => {
      render(
        <Tabs>
          <TabItem value="tab1" label="First">
            Content 1
          </TabItem>
          <TabItem value="tab2" label="Second">
            Content 2
          </TabItem>
          <TabItem value="tab3" label="Third">
            Content 3
          </TabItem>
        </Tabs>
      );
      expect(screen.getByRole('tab', { name: 'First' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Second' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Third' })).toBeInTheDocument();
    });

    it('renders tab panels', () => {
      const { container } = render(
        <Tabs>
          <TabItem value="tab1">Content 1</TabItem>
          <TabItem value="tab2">Content 2</TabItem>
        </Tabs>
      );
      const panels = container.querySelectorAll('[role="tabpanel"]');
      expect(panels).toHaveLength(2);
    });
  });

  describe('CSS classes', () => {
    it('applies header class', () => {
      const { container } = render(
        <Tabs>
          <TabItem value="tab1">Content</TabItem>
        </Tabs>
      );
      expect(
        container.querySelector('.mdx-preview-generic-tabs-header')
      ).toBeInTheDocument();
    });

    it('applies button class to tab buttons', () => {
      const { container } = render(
        <Tabs>
          <TabItem value="tab1">Content</TabItem>
        </Tabs>
      );
      expect(
        container.querySelector('.mdx-preview-generic-tabs-button')
      ).toBeInTheDocument();
    });

    it('applies content class', () => {
      const { container } = render(
        <Tabs>
          <TabItem value="tab1">Content</TabItem>
        </Tabs>
      );
      expect(
        container.querySelector('.mdx-preview-generic-tabs-content')
      ).toBeInTheDocument();
    });

    it('applies panel class', () => {
      const { container } = render(
        <Tabs>
          <TabItem value="tab1">Content</TabItem>
        </Tabs>
      );
      expect(
        container.querySelector('.mdx-preview-generic-tabs-panel')
      ).toBeInTheDocument();
    });

    it('applies custom className to wrapper', () => {
      const { container } = render(
        <Tabs className="custom-tabs">
          <TabItem value="tab1">Content</TabItem>
        </Tabs>
      );
      expect(container.querySelector('.custom-tabs')).toBeInTheDocument();
    });
  });

  describe('default tab selection', () => {
    it('first tab is active by default', () => {
      render(
        <Tabs>
          <TabItem value="tab1" label="First">
            Content 1
          </TabItem>
          <TabItem value="tab2" label="Second">
            Content 2
          </TabItem>
        </Tabs>
      );
      const firstTab = screen.getByRole('tab', { name: 'First' });
      expect(firstTab).toHaveAttribute('aria-selected', 'true');
      expect(firstTab).toHaveClass('active');
    });

    it('defaultValue selects initial tab', () => {
      render(
        <Tabs defaultValue="tab2">
          <TabItem value="tab1" label="First">
            Content 1
          </TabItem>
          <TabItem value="tab2" label="Second">
            Content 2
          </TabItem>
        </Tabs>
      );
      const secondTab = screen.getByRole('tab', { name: 'Second' });
      expect(secondTab).toHaveAttribute('aria-selected', 'true');
    });

    it('respects default prop on TabItem', () => {
      render(
        <Tabs>
          <TabItem value="tab1" label="First">
            Content 1
          </TabItem>
          <TabItem value="tab2" label="Second" default>
            Content 2
          </TabItem>
        </Tabs>
      );
      const secondTab = screen.getByRole('tab', { name: 'Second' });
      expect(secondTab).toHaveAttribute('aria-selected', 'true');
    });

    it('defaultValue takes precedence over default prop', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabItem value="tab1" label="First">
            Content 1
          </TabItem>
          <TabItem value="tab2" label="Second" default>
            Content 2
          </TabItem>
        </Tabs>
      );
      const firstTab = screen.getByRole('tab', { name: 'First' });
      expect(firstTab).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('tab switching', () => {
    it('clicking a tab changes active state', () => {
      render(
        <Tabs>
          <TabItem value="tab1" label="First">
            Content 1
          </TabItem>
          <TabItem value="tab2" label="Second">
            Content 2
          </TabItem>
        </Tabs>
      );

      const firstTab = screen.getByRole('tab', { name: 'First' });
      const secondTab = screen.getByRole('tab', { name: 'Second' });

      expect(firstTab).toHaveAttribute('aria-selected', 'true');
      expect(secondTab).toHaveAttribute('aria-selected', 'false');

      fireEvent.click(secondTab);

      expect(firstTab).toHaveAttribute('aria-selected', 'false');
      expect(secondTab).toHaveAttribute('aria-selected', 'true');
    });

    it('shows content for active tab', () => {
      const { container } = render(
        <Tabs>
          <TabItem value="tab1" label="First">
            Content 1
          </TabItem>
          <TabItem value="tab2" label="Second">
            Content 2
          </TabItem>
        </Tabs>
      );

      const panels = container.querySelectorAll('[role="tabpanel"]');
      expect(panels[0]).not.toHaveAttribute('hidden');
      expect(panels[1]).toHaveAttribute('hidden');

      fireEvent.click(screen.getByRole('tab', { name: 'Second' }));

      expect(panels[0]).toHaveAttribute('hidden');
      expect(panels[1]).not.toHaveAttribute('hidden');
    });

    it('active panel has active class', () => {
      const { container } = render(
        <Tabs>
          <TabItem value="tab1" label="First">
            Content 1
          </TabItem>
          <TabItem value="tab2" label="Second">
            Content 2
          </TabItem>
        </Tabs>
      );

      const panels = container.querySelectorAll('[role="tabpanel"]');
      expect(panels[0]).toHaveClass('active');
      expect(panels[1]).not.toHaveClass('active');

      fireEvent.click(screen.getByRole('tab', { name: 'Second' }));

      expect(panels[0]).not.toHaveClass('active');
      expect(panels[1]).toHaveClass('active');
    });
  });

  describe('accessibility', () => {
    it('tab buttons have role="tab"', () => {
      render(
        <Tabs>
          <TabItem value="tab1" label="First">
            Content
          </TabItem>
        </Tabs>
      );
      expect(screen.getByRole('tab')).toBeInTheDocument();
    });

    it('tab list has role="tablist"', () => {
      const { container } = render(
        <Tabs>
          <TabItem value="tab1">Content</TabItem>
        </Tabs>
      );
      expect(container.querySelector('[role="tablist"]')).toBeInTheDocument();
    });

    it('tab panels have role="tabpanel"', () => {
      const { container } = render(
        <Tabs>
          <TabItem value="tab1">Content</TabItem>
        </Tabs>
      );
      expect(container.querySelector('[role="tabpanel"]')).toBeInTheDocument();
    });

    it('active tab has aria-selected="true"', () => {
      render(
        <Tabs>
          <TabItem value="tab1" label="Active">
            Content
          </TabItem>
        </Tabs>
      );
      expect(screen.getByRole('tab')).toHaveAttribute('aria-selected', 'true');
    });

    it('inactive tabs have aria-selected="false"', () => {
      render(
        <Tabs>
          <TabItem value="tab1" label="First">
            Content 1
          </TabItem>
          <TabItem value="tab2" label="Second">
            Content 2
          </TabItem>
        </Tabs>
      );
      const secondTab = screen.getByRole('tab', { name: 'Second' });
      expect(secondTab).toHaveAttribute('aria-selected', 'false');
    });

    it('active tab has tabIndex="0"', () => {
      render(
        <Tabs>
          <TabItem value="tab1" label="First">
            Content
          </TabItem>
        </Tabs>
      );
      expect(screen.getByRole('tab')).toHaveAttribute('tabIndex', '0');
    });

    it('inactive tabs have tabIndex="-1"', () => {
      render(
        <Tabs>
          <TabItem value="tab1" label="First">
            Content 1
          </TabItem>
          <TabItem value="tab2" label="Second">
            Content 2
          </TabItem>
        </Tabs>
      );
      const secondTab = screen.getByRole('tab', { name: 'Second' });
      expect(secondTab).toHaveAttribute('tabIndex', '-1');
    });

    it('inactive panels have hidden attribute', () => {
      const { container } = render(
        <Tabs>
          <TabItem value="tab1">Content 1</TabItem>
          <TabItem value="tab2">Content 2</TabItem>
        </Tabs>
      );
      const panels = container.querySelectorAll('[role="tabpanel"]');
      expect(panels[1]).toHaveAttribute('hidden');
    });
  });

  describe('values prop', () => {
    it('uses provided values for tab labels', () => {
      render(
        <Tabs
          values={[
            { value: 'tab1', label: 'Custom Label 1' },
            { value: 'tab2', label: 'Custom Label 2' },
          ]}
        >
          <TabItem value="tab1">Content 1</TabItem>
          <TabItem value="tab2">Content 2</TabItem>
        </Tabs>
      );
      expect(
        screen.getByRole('tab', { name: 'Custom Label 1' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('tab', { name: 'Custom Label 2' })
      ).toBeInTheDocument();
    });

    it('values prop overrides label prop on TabItem', () => {
      render(
        <Tabs values={[{ value: 'tab1', label: 'Values Label' }]}>
          <TabItem value="tab1" label="TabItem Label">
            Content
          </TabItem>
        </Tabs>
      );
      expect(
        screen.getByRole('tab', { name: 'Values Label' })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('tab', { name: 'TabItem Label' })
      ).not.toBeInTheDocument();
    });
  });

  describe('label extraction', () => {
    it('uses label prop when provided', () => {
      render(
        <Tabs>
          <TabItem value="tab1" label="Label Prop">
            Content
          </TabItem>
        </Tabs>
      );
      expect(
        screen.getByRole('tab', { name: 'Label Prop' })
      ).toBeInTheDocument();
    });

    it('falls back to value when label not provided', () => {
      render(
        <Tabs>
          <TabItem value="fallback-value">Content</TabItem>
        </Tabs>
      );
      expect(
        screen.getByRole('tab', { name: 'fallback-value' })
      ).toBeInTheDocument();
    });
  });

  describe('empty states', () => {
    it('handles empty children gracefully', () => {
      const { container } = render(<Tabs>{null}</Tabs>);
      expect(
        container.querySelector('.mdx-preview-generic-tabs')
      ).toBeInTheDocument();
    });

    it('handles no TabItem children', () => {
      const { container } = render(
        <Tabs>
          <div>Not a TabItem</div>
        </Tabs>
      );
      expect(
        container.querySelector('.mdx-preview-generic-tabs')
      ).toBeInTheDocument();
    });
  });

  describe('multiple tabs', () => {
    it('renders many tabs correctly', () => {
      render(
        <Tabs>
          <TabItem value="tab1" label="One">
            1
          </TabItem>
          <TabItem value="tab2" label="Two">
            2
          </TabItem>
          <TabItem value="tab3" label="Three">
            3
          </TabItem>
          <TabItem value="tab4" label="Four">
            4
          </TabItem>
          <TabItem value="tab5" label="Five">
            5
          </TabItem>
        </Tabs>
      );
      expect(screen.getAllByRole('tab')).toHaveLength(5);
    });

    it('can switch between multiple tabs', () => {
      render(
        <Tabs>
          <TabItem value="tab1" label="One">
            Content 1
          </TabItem>
          <TabItem value="tab2" label="Two">
            Content 2
          </TabItem>
          <TabItem value="tab3" label="Three">
            Content 3
          </TabItem>
        </Tabs>
      );

      // Start on first tab
      expect(screen.getByRole('tab', { name: 'One' })).toHaveAttribute(
        'aria-selected',
        'true'
      );

      // Switch to third tab
      fireEvent.click(screen.getByRole('tab', { name: 'Three' }));
      expect(screen.getByRole('tab', { name: 'Three' })).toHaveAttribute(
        'aria-selected',
        'true'
      );

      // Switch back to second tab
      fireEvent.click(screen.getByRole('tab', { name: 'Two' }));
      expect(screen.getByRole('tab', { name: 'Two' })).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });
  });
});

describe('useGenericTabsContext', () => {
  it('returns false outside of Tabs', () => {
    function TestComponent() {
      const isInTabs = useGenericTabsContext();
      return <div data-testid="result">{isInTabs ? 'inside' : 'outside'}</div>;
    }

    render(<TestComponent />);
    expect(screen.getByTestId('result')).toHaveTextContent('outside');
  });

  it('returns true inside Tabs', () => {
    function TestComponent() {
      const isInTabs = useGenericTabsContext();
      return <div data-testid="result">{isInTabs ? 'inside' : 'outside'}</div>;
    }

    render(
      <Tabs>
        <TabItem value="tab1">
          <TestComponent />
        </TabItem>
      </Tabs>
    );
    expect(screen.getByTestId('result')).toHaveTextContent('inside');
  });
});

describe('GenericTabsContext', () => {
  it('provides context value', () => {
    function TestComponent() {
      const value = useContext(GenericTabsContext);
      return <div data-testid="context">{String(value)}</div>;
    }

    render(
      <Tabs>
        <TabItem value="tab1">
          <TestComponent />
        </TabItem>
      </Tabs>
    );
    expect(screen.getByTestId('context')).toHaveTextContent('true');
  });
});
