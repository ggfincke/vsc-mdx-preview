// packages/webview-app/src/components/shims/generic/Collapsible.test.tsx
// Tests for generic Collapsible and Accordion components

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Collapsible, Accordion } from './Collapsible';

describe('Collapsible', () => {
  describe('rendering', () => {
    it('renders children content', () => {
      render(<Collapsible title="Test">Test content</Collapsible>);
      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('renders as details element', () => {
      const { container } = render(
        <Collapsible title="Test">Content</Collapsible>
      );
      expect(container.querySelector('details')).toBeInTheDocument();
    });

    it('renders summary element with title', () => {
      render(<Collapsible title="Click to expand">Content</Collapsible>);
      expect(screen.getByText('Click to expand')).toBeInTheDocument();
    });

    it('applies base CSS class', () => {
      const { container } = render(
        <Collapsible title="Test">Content</Collapsible>
      );
      expect(
        container.querySelector('.mdx-preview-generic-collapsible')
      ).toBeInTheDocument();
    });

    it('renders summary with correct CSS class', () => {
      const { container } = render(
        <Collapsible title="Test">Content</Collapsible>
      );
      expect(
        container.querySelector('.mdx-preview-generic-collapsible-summary')
      ).toBeInTheDocument();
    });

    it('renders content with correct CSS class', () => {
      const { container } = render(
        <Collapsible title="Test">Content</Collapsible>
      );
      expect(
        container.querySelector('.mdx-preview-generic-collapsible-content')
      ).toBeInTheDocument();
    });

    it('renders chevron icon', () => {
      const { container } = render(
        <Collapsible title="Test">Content</Collapsible>
      );
      const icon = container.querySelector(
        '.mdx-preview-generic-collapsible-icon'
      );
      expect(icon).toBeInTheDocument();
      expect(icon?.innerHTML).toContain('svg');
    });
  });

  describe('default state', () => {
    it('starts closed by default', () => {
      const { container } = render(
        <Collapsible title="Test">Content</Collapsible>
      );
      const details = container.querySelector('details');
      expect(details).not.toHaveAttribute('open');
    });

    it('icon does not have open class when closed', () => {
      const { container } = render(
        <Collapsible title="Test">Content</Collapsible>
      );
      const icon = container.querySelector(
        '.mdx-preview-generic-collapsible-icon'
      );
      expect(icon).not.toHaveClass('open');
    });
  });

  describe('defaultOpen prop', () => {
    it('starts open when defaultOpen is true', () => {
      const { container } = render(
        <Collapsible title="Test" defaultOpen={true}>
          Content
        </Collapsible>
      );
      const details = container.querySelector('details');
      expect(details).toHaveAttribute('open');
    });

    it('starts closed when defaultOpen is false', () => {
      const { container } = render(
        <Collapsible title="Test" defaultOpen={false}>
          Content
        </Collapsible>
      );
      const details = container.querySelector('details');
      expect(details).not.toHaveAttribute('open');
    });

    it('icon has open class when defaultOpen is true', () => {
      const { container } = render(
        <Collapsible title="Test" defaultOpen={true}>
          Content
        </Collapsible>
      );
      const icon = container.querySelector(
        '.mdx-preview-generic-collapsible-icon'
      );
      expect(icon).toHaveClass('open');
    });
  });

  describe('toggle behavior', () => {
    it('opens when summary is clicked', () => {
      const { container } = render(
        <Collapsible title="Test">Content</Collapsible>
      );
      const summary = container.querySelector('summary');
      const details = container.querySelector('details');

      expect(details).not.toHaveAttribute('open');

      fireEvent.click(summary!);

      expect(details).toHaveAttribute('open');
    });

    it('closes when summary is clicked while open', () => {
      const { container } = render(
        <Collapsible title="Test" defaultOpen={true}>
          Content
        </Collapsible>
      );
      const summary = container.querySelector('summary');
      const details = container.querySelector('details');

      expect(details).toHaveAttribute('open');

      fireEvent.click(summary!);

      expect(details).not.toHaveAttribute('open');
    });

    it('toggles icon open class on click', () => {
      const { container } = render(
        <Collapsible title="Test">Content</Collapsible>
      );
      const summary = container.querySelector('summary');
      const icon = container.querySelector(
        '.mdx-preview-generic-collapsible-icon'
      );

      expect(icon).not.toHaveClass('open');

      fireEvent.click(summary!);

      expect(icon).toHaveClass('open');

      fireEvent.click(summary!);

      expect(icon).not.toHaveClass('open');
    });

    it('toggles multiple times correctly', () => {
      const { container } = render(
        <Collapsible title="Test">Content</Collapsible>
      );
      const summary = container.querySelector('summary');
      const details = container.querySelector('details');

      // Click 1: open
      fireEvent.click(summary!);
      expect(details).toHaveAttribute('open');

      // Click 2: close
      fireEvent.click(summary!);
      expect(details).not.toHaveAttribute('open');

      // Click 3: open
      fireEvent.click(summary!);
      expect(details).toHaveAttribute('open');

      // Click 4: close
      fireEvent.click(summary!);
      expect(details).not.toHaveAttribute('open');
    });
  });

  describe('title and summary props', () => {
    it('uses title prop for display', () => {
      render(<Collapsible title="Title Text">Content</Collapsible>);
      expect(screen.getByText('Title Text')).toBeInTheDocument();
    });

    it('uses summary prop when provided', () => {
      render(
        <Collapsible title="Title" summary="Summary Text">
          Content
        </Collapsible>
      );
      expect(screen.getByText('Summary Text')).toBeInTheDocument();
    });

    it('summary prop overrides title prop', () => {
      render(
        <Collapsible title="Title" summary="Summary">
          Content
        </Collapsible>
      );
      expect(screen.getByText('Summary')).toBeInTheDocument();
      expect(screen.queryByText('Title')).not.toBeInTheDocument();
    });

    it('renders title in correct element', () => {
      const { container } = render(
        <Collapsible title="My Title">Content</Collapsible>
      );
      const titleElement = container.querySelector(
        '.mdx-preview-generic-collapsible-title'
      );
      expect(titleElement).toHaveTextContent('My Title');
    });
  });

  describe('children content', () => {
    it('renders text children', () => {
      render(<Collapsible title="Test">Plain text content</Collapsible>);
      expect(screen.getByText('Plain text content')).toBeInTheDocument();
    });

    it('renders element children', () => {
      render(
        <Collapsible title="Test">
          <p data-testid="paragraph">Paragraph content</p>
        </Collapsible>
      );
      expect(screen.getByTestId('paragraph')).toBeInTheDocument();
      expect(screen.getByTestId('paragraph')).toHaveTextContent(
        'Paragraph content'
      );
    });

    it('renders multiple children', () => {
      render(
        <Collapsible title="Test">
          <p>First</p>
          <p>Second</p>
          <p>Third</p>
        </Collapsible>
      );
      expect(screen.getByText('First')).toBeInTheDocument();
      expect(screen.getByText('Second')).toBeInTheDocument();
      expect(screen.getByText('Third')).toBeInTheDocument();
    });

    it('renders nested components', () => {
      const NestedComponent = () => <span>Nested</span>;
      render(
        <Collapsible title="Test">
          <NestedComponent />
        </Collapsible>
      );
      expect(screen.getByText('Nested')).toBeInTheDocument();
    });
  });
});

describe('Accordion', () => {
  it('renders same as Collapsible', () => {
    const { container } = render(
      <Accordion title="Accordion Title">Accordion content</Accordion>
    );
    expect(
      container.querySelector('.mdx-preview-generic-collapsible')
    ).toBeInTheDocument();
    expect(screen.getByText('Accordion content')).toBeInTheDocument();
    expect(screen.getByText('Accordion Title')).toBeInTheDocument();
  });

  it('starts closed by default', () => {
    const { container } = render(
      <Accordion title="Test">Content</Accordion>
    );
    const details = container.querySelector('details');
    expect(details).not.toHaveAttribute('open');
  });

  it('respects defaultOpen prop', () => {
    const { container } = render(
      <Accordion title="Test" defaultOpen={true}>
        Content
      </Accordion>
    );
    const details = container.querySelector('details');
    expect(details).toHaveAttribute('open');
  });

  it('respects summary prop', () => {
    render(
      <Accordion title="Title" summary="Accordion Summary">
        Content
      </Accordion>
    );
    expect(screen.getByText('Accordion Summary')).toBeInTheDocument();
    expect(screen.queryByText('Title')).not.toBeInTheDocument();
  });

  it('toggles on click', () => {
    const { container } = render(
      <Accordion title="Test">Content</Accordion>
    );
    const summary = container.querySelector('summary');
    const details = container.querySelector('details');

    expect(details).not.toHaveAttribute('open');
    fireEvent.click(summary!);
    expect(details).toHaveAttribute('open');
  });

  it('passes all props to Collapsible', () => {
    const { container } = render(
      <Accordion title="Title" summary="Summary" defaultOpen={true}>
        <p data-testid="content">Content</p>
      </Accordion>
    );

    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(container.querySelector('details')).toHaveAttribute('open');
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });
});
