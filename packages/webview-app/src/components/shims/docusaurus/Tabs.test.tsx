// Tests for Docusaurus Tabs/TabItem component shim

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { Tabs, TabItem } from './Tabs';

describe('Tabs', () => {
  describe('rendering', () => {
    it('renders tab headers from TabItem children', () => {
      render(
        <Tabs>
          <TabItem value="js" label="JavaScript">
            JS content
          </TabItem>
          <TabItem value="ts" label="TypeScript">
            TS content
          </TabItem>
        </Tabs>
      );

      expect(screen.getByRole('tab', { name: 'JavaScript' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'TypeScript' })).toBeInTheDocument();
    });

    it('renders tab panels for each TabItem', () => {
      render(
        <Tabs>
          <TabItem value="one" label="One">
            Content One
          </TabItem>
          <TabItem value="two" label="Two">
            Content Two
          </TabItem>
        </Tabs>
      );

      const panels = screen.getAllByRole('tabpanel', { hidden: true });
      expect(panels).toHaveLength(2);
    });

    it('uses value as label when label not provided', () => {
      render(
        <Tabs>
          <TabItem value="myValue">Content</TabItem>
        </Tabs>
      );

      expect(screen.getByRole('tab', { name: 'myValue' })).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <Tabs className="custom-tabs">
          <TabItem value="tab">Content</TabItem>
        </Tabs>
      );

      const tabsDiv = container.querySelector('.docusaurus-tabs');
      expect(tabsDiv).toHaveClass('custom-tabs');
    });

    it('applies groupId as data attribute', () => {
      const { container } = render(
        <Tabs groupId="code-examples">
          <TabItem value="tab">Content</TabItem>
        </Tabs>
      );

      const tabsDiv = container.querySelector('.docusaurus-tabs');
      expect(tabsDiv).toHaveAttribute('data-group-id', 'code-examples');
    });
  });

  describe('default tab selection', () => {
    it('shows first tab content by default', () => {
      render(
        <Tabs>
          <TabItem value="first">First content</TabItem>
          <TabItem value="second">Second content</TabItem>
        </Tabs>
      );

      // First panel should be visible (not hidden)
      const panels = screen.getAllByRole('tabpanel', { hidden: true });
      expect(panels[0]).not.toHaveAttribute('hidden');
      expect(panels[1]).toHaveAttribute('hidden');
    });

    it('shows defaultValue tab when specified', () => {
      render(
        <Tabs defaultValue="second">
          <TabItem value="first">First content</TabItem>
          <TabItem value="second">Second content</TabItem>
        </Tabs>
      );

      const panels = screen.getAllByRole('tabpanel', { hidden: true });
      expect(panels[0]).toHaveAttribute('hidden');
      expect(panels[1]).not.toHaveAttribute('hidden');
    });

    it('respects default prop on TabItem', () => {
      render(
        <Tabs>
          <TabItem value="first">First</TabItem>
          <TabItem value="second" default>
            Second
          </TabItem>
        </Tabs>
      );

      const panels = screen.getAllByRole('tabpanel', { hidden: true });
      expect(panels[0]).toHaveAttribute('hidden');
      expect(panels[1]).not.toHaveAttribute('hidden');
    });
  });

  describe('tab switching', () => {
    it('switches content when clicking tab header', async () => {
      const user = userEvent.setup();
      render(
        <Tabs>
          <TabItem value="first" label="First">
            First content
          </TabItem>
          <TabItem value="second" label="Second">
            Second content
          </TabItem>
        </Tabs>
      );

      // Initially first tab is active
      let panels = screen.getAllByRole('tabpanel', { hidden: true });
      expect(panels[0]).not.toHaveAttribute('hidden');
      expect(panels[1]).toHaveAttribute('hidden');

      // Click second tab
      await user.click(screen.getByRole('tab', { name: 'Second' }));

      // Second tab should now be active
      panels = screen.getAllByRole('tabpanel', { hidden: true });
      expect(panels[0]).toHaveAttribute('hidden');
      expect(panels[1]).not.toHaveAttribute('hidden');
    });

    it('updates active class on tab buttons', async () => {
      const user = userEvent.setup();
      render(
        <Tabs>
          <TabItem value="first" label="First">
            First
          </TabItem>
          <TabItem value="second" label="Second">
            Second
          </TabItem>
        </Tabs>
      );

      const firstTab = screen.getByRole('tab', { name: 'First' });
      const secondTab = screen.getByRole('tab', { name: 'Second' });

      // Initially first is active
      expect(firstTab).toHaveClass('active');
      expect(secondTab).not.toHaveClass('active');

      // Click second tab
      await user.click(secondTab);

      expect(firstTab).not.toHaveClass('active');
      expect(secondTab).toHaveClass('active');
    });
  });

  describe('accessibility', () => {
    it('tab buttons have role="tab"', () => {
      render(
        <Tabs>
          <TabItem value="tab" label="Tab">
            Content
          </TabItem>
        </Tabs>
      );

      expect(screen.getByRole('tab')).toBeInTheDocument();
    });

    it('tab list has role="tablist"', () => {
      render(
        <Tabs>
          <TabItem value="tab" label="Tab">
            Content
          </TabItem>
        </Tabs>
      );

      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    it('tab panels have role="tabpanel"', () => {
      render(
        <Tabs>
          <TabItem value="tab" label="Tab">
            Content
          </TabItem>
        </Tabs>
      );

      expect(screen.getByRole('tabpanel')).toBeInTheDocument();
    });

    it('active tab has aria-selected="true"', () => {
      render(
        <Tabs>
          <TabItem value="first" label="First">
            First
          </TabItem>
          <TabItem value="second" label="Second">
            Second
          </TabItem>
        </Tabs>
      );

      const firstTab = screen.getByRole('tab', { name: 'First' });
      const secondTab = screen.getByRole('tab', { name: 'Second' });

      expect(firstTab).toHaveAttribute('aria-selected', 'true');
      expect(secondTab).toHaveAttribute('aria-selected', 'false');
    });

    it('active tab has tabIndex=0, others have tabIndex=-1', () => {
      render(
        <Tabs>
          <TabItem value="first" label="First">
            First
          </TabItem>
          <TabItem value="second" label="Second">
            Second
          </TabItem>
        </Tabs>
      );

      const firstTab = screen.getByRole('tab', { name: 'First' });
      const secondTab = screen.getByRole('tab', { name: 'Second' });

      expect(firstTab).toHaveAttribute('tabindex', '0');
      expect(secondTab).toHaveAttribute('tabindex', '-1');
    });
  });

  describe('edge cases', () => {
    it('handles invalid activeValue (falls back to first)', () => {
      render(
        <Tabs defaultValue="nonexistent">
          <TabItem value="first">First</TabItem>
          <TabItem value="second">Second</TabItem>
        </Tabs>
      );

      const firstTab = screen.getByRole('tab', { name: 'first' });
      expect(firstTab).toHaveClass('active');
    });

    it('handles values prop override', () => {
      render(
        <Tabs values={[{ value: 'a', label: 'Tab A' }, { value: 'b', label: 'Tab B' }]}>
          <TabItem value="a">Content A</TabItem>
          <TabItem value="b">Content B</TabItem>
        </Tabs>
      );

      expect(screen.getByRole('tab', { name: 'Tab A' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Tab B' })).toBeInTheDocument();
    });

    it('handles empty children gracefully', () => {
      const { container } = render(<Tabs>{null}</Tabs>);

      expect(container.querySelector('.docusaurus-tabs')).toBeInTheDocument();
    });
  });
});

describe('TabItem', () => {
  it('renders children when outside Tabs context', () => {
    render(<TabItem value="standalone">Standalone content</TabItem>);

    expect(screen.getByText('Standalone content')).toBeInTheDocument();
  });

  it('applies tab-item class when outside context', () => {
    const { container } = render(
      <TabItem value="standalone">Content</TabItem>
    );

    expect(container.querySelector('.tab-item')).toBeInTheDocument();
  });
});
