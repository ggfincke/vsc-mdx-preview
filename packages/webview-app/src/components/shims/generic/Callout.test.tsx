// packages/webview-app/src/components/shims/generic/Callout.test.tsx
// Tests for generic Callout, Alert, and Admonition components

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Callout, Alert, Admonition } from './Callout';
import type { CalloutType } from './types';

describe('Callout', () => {
  describe('rendering', () => {
    it('renders children content', () => {
      render(<Callout>Test content</Callout>);
      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('renders as aside element', () => {
      const { container } = render(<Callout>Content</Callout>);
      expect(container.querySelector('aside')).toBeInTheDocument();
    });

    it('applies base CSS class', () => {
      const { container } = render(<Callout>Content</Callout>);
      expect(
        container.querySelector('.mdx-preview-generic-callout')
      ).toBeInTheDocument();
    });
  });

  describe('type handling', () => {
    const validTypes: CalloutType[] = [
      'note',
      'tip',
      'warning',
      'danger',
      'info',
      'caution',
      'important',
    ];

    it.each(validTypes)('renders %s type with correct class', (type) => {
      const { container } = render(<Callout type={type}>Content</Callout>);
      expect(
        container.querySelector(`.mdx-preview-generic-callout-${type}`)
      ).toBeInTheDocument();
    });

    it.each(validTypes)(
      'sets data-callout-type="%s" attribute',
      (type) => {
        const { container } = render(<Callout type={type}>Content</Callout>);
        expect(
          container.querySelector(`[data-callout-type="${type}"]`)
        ).toBeInTheDocument();
      }
    );

    it('defaults to note type when type is undefined', () => {
      const { container } = render(<Callout>Content</Callout>);
      expect(
        container.querySelector('.mdx-preview-generic-callout-note')
      ).toBeInTheDocument();
      expect(
        container.querySelector('[data-callout-type="note"]')
      ).toBeInTheDocument();
    });

    it('normalizes "success" to "tip"', () => {
      const { container } = render(
        <Callout type={'success' as CalloutType}>Content</Callout>
      );
      expect(
        container.querySelector('.mdx-preview-generic-callout-tip')
      ).toBeInTheDocument();
    });

    it('normalizes "error" to "danger"', () => {
      const { container } = render(
        <Callout type={'error' as CalloutType}>Content</Callout>
      );
      expect(
        container.querySelector('.mdx-preview-generic-callout-danger')
      ).toBeInTheDocument();
    });

    it('normalizes "warn" to "warning"', () => {
      const { container } = render(
        <Callout type={'warn' as CalloutType}>Content</Callout>
      );
      expect(
        container.querySelector('.mdx-preview-generic-callout-warning')
      ).toBeInTheDocument();
    });

    it('normalizes unknown types to "note"', () => {
      const { container } = render(
        <Callout type={'unknown' as CalloutType}>Content</Callout>
      );
      expect(
        container.querySelector('.mdx-preview-generic-callout-note')
      ).toBeInTheDocument();
    });
  });

  describe('title handling', () => {
    it('uses custom title when provided', () => {
      render(<Callout title="Custom Title">Content</Callout>);
      expect(screen.getByText('Custom Title')).toBeInTheDocument();
    });

    it('uses default title "Note" for note type', () => {
      render(<Callout type="note">Content</Callout>);
      expect(screen.getByText('Note')).toBeInTheDocument();
    });

    it('uses default title "Tip" for tip type', () => {
      render(<Callout type="tip">Content</Callout>);
      expect(screen.getByText('Tip')).toBeInTheDocument();
    });

    it('uses default title "Warning" for warning type', () => {
      render(<Callout type="warning">Content</Callout>);
      expect(screen.getByText('Warning')).toBeInTheDocument();
    });

    it('uses default title "Danger" for danger type', () => {
      render(<Callout type="danger">Content</Callout>);
      expect(screen.getByText('Danger')).toBeInTheDocument();
    });

    it('custom title overrides type default', () => {
      render(
        <Callout type="warning" title="My Warning">
          Content
        </Callout>
      );
      expect(screen.getByText('My Warning')).toBeInTheDocument();
      expect(screen.queryByText('Warning')).not.toBeInTheDocument();
    });
  });

  describe('icon handling', () => {
    it('renders default SVG icon for type', () => {
      const { container } = render(<Callout type="note">Content</Callout>);
      const icon = container.querySelector('.mdx-preview-generic-callout-icon');
      expect(icon).toBeInTheDocument();
      expect(icon?.innerHTML).toContain('svg');
    });

    it('renders custom icon when provided', () => {
      render(
        <Callout icon={<span data-testid="custom-icon">*</span>}>
          Content
        </Callout>
      );
      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });

    it('custom icon replaces default SVG', () => {
      const { container } = render(
        <Callout icon={<span data-testid="custom-icon">*</span>}>
          Content
        </Callout>
      );
      const icon = container.querySelector('.mdx-preview-generic-callout-icon');
      expect(icon).toBeInTheDocument();
      // Custom icon should not use dangerouslySetInnerHTML
      expect(icon?.innerHTML).not.toContain('<svg');
    });
  });

  describe('structure', () => {
    it('has header with icon and title', () => {
      const { container } = render(<Callout>Content</Callout>);
      const header = container.querySelector(
        '.mdx-preview-generic-callout-header'
      );
      expect(header).toBeInTheDocument();
      expect(
        header?.querySelector('.mdx-preview-generic-callout-icon')
      ).toBeInTheDocument();
      expect(
        header?.querySelector('.mdx-preview-generic-callout-title')
      ).toBeInTheDocument();
    });

    it('has content section with children', () => {
      const { container } = render(
        <Callout>
          <p>Paragraph content</p>
        </Callout>
      );
      const content = container.querySelector(
        '.mdx-preview-generic-callout-content'
      );
      expect(content).toBeInTheDocument();
      expect(content?.querySelector('p')).toHaveTextContent('Paragraph content');
    });
  });
});

describe('Alert', () => {
  it('renders same as Callout', () => {
    const { container } = render(
      <Alert type="warning">Alert content</Alert>
    );
    expect(
      container.querySelector('.mdx-preview-generic-callout-warning')
    ).toBeInTheDocument();
    expect(screen.getByText('Alert content')).toBeInTheDocument();
    expect(screen.getByText('Warning')).toBeInTheDocument();
  });

  it('passes all props to Callout', () => {
    render(
      <Alert type="tip" title="Custom Alert Title">
        Alert content
      </Alert>
    );
    expect(screen.getByText('Custom Alert Title')).toBeInTheDocument();
  });
});

describe('Admonition', () => {
  it('renders same as Callout', () => {
    const { container } = render(
      <Admonition type="danger">Admonition content</Admonition>
    );
    expect(
      container.querySelector('.mdx-preview-generic-callout-danger')
    ).toBeInTheDocument();
    expect(screen.getByText('Admonition content')).toBeInTheDocument();
    expect(screen.getByText('Danger')).toBeInTheDocument();
  });

  it('passes all props to Callout', () => {
    render(
      <Admonition type="info" title="Custom Info Title">
        Admonition content
      </Admonition>
    );
    expect(screen.getByText('Custom Info Title')).toBeInTheDocument();
  });
});
