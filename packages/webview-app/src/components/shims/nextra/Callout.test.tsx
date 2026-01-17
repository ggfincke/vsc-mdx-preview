// packages/webview-app/src/components/shims/nextra/Callout.test.tsx
// Tests for Nextra Callout component shim

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Callout } from './Callout';
import type { CalloutType } from './Callout';

describe('Nextra Callout', () => {
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
        container.querySelector('.mdx-preview-nextra-callout')
      ).toBeInTheDocument();
    });
  });

  describe('type variants', () => {
    const validTypes: Array<Exclude<CalloutType, null>> = [
      'default',
      'info',
      'warning',
      'error',
      'important',
    ];

    it.each(validTypes)('renders %s type with correct class', (type) => {
      const { container } = render(<Callout type={type}>Content</Callout>);
      expect(
        container.querySelector(`.mdx-preview-nextra-callout-${type}`)
      ).toBeInTheDocument();
    });

    it('defaults to "default" type when type is undefined', () => {
      const { container } = render(<Callout>Content</Callout>);
      expect(
        container.querySelector('.mdx-preview-nextra-callout-default')
      ).toBeInTheDocument();
    });

    it('renders without type class when type is null', () => {
      const { container } = render(<Callout type={null}>Content</Callout>);
      const callout = container.querySelector('.mdx-preview-nextra-callout');
      expect(callout).toBeInTheDocument();
      expect(callout).not.toHaveClass('mdx-preview-nextra-callout-default');
      expect(callout).not.toHaveClass('mdx-preview-nextra-callout-info');
    });
  });

  describe('icon handling', () => {
    it('renders default icon for type', () => {
      const { container } = render(<Callout type="info">Content</Callout>);
      const icon = container.querySelector('.mdx-preview-nextra-callout-icon');
      expect(icon).toBeInTheDocument();
      expect(icon?.querySelector('svg')).toBeInTheDocument();
    });

    it('renders custom emoji when provided', () => {
      render(<Callout emoji="🚀">Content</Callout>);
      expect(screen.getByText('🚀')).toBeInTheDocument();
    });

    it('renders custom React element as emoji', () => {
      render(
        <Callout emoji={<span data-testid="custom-emoji">★</span>}>
          Content
        </Callout>
      );
      expect(screen.getByTestId('custom-emoji')).toBeInTheDocument();
    });

    it('emoji overrides default icon', () => {
      const { container } = render(
        <Callout type="warning" emoji="⚠️">
          Content
        </Callout>
      );
      expect(screen.getByText('⚠️')).toBeInTheDocument();
      // Should not have SVG since emoji overrides
      const icon = container.querySelector('.mdx-preview-nextra-callout-icon');
      expect(icon?.querySelector('svg')).not.toBeInTheDocument();
    });

    it('does not render icon when type is null and no emoji', () => {
      const { container } = render(<Callout type={null}>Content</Callout>);
      const icon = container.querySelector('.mdx-preview-nextra-callout-icon');
      expect(icon).not.toBeInTheDocument();
    });
  });

  describe('structure', () => {
    it('has icon container when icon exists', () => {
      const { container } = render(<Callout>Content</Callout>);
      expect(
        container.querySelector('.mdx-preview-nextra-callout-icon')
      ).toBeInTheDocument();
    });

    it('has content container', () => {
      const { container } = render(
        <Callout>
          <p>Paragraph content</p>
        </Callout>
      );
      const content = container.querySelector(
        '.mdx-preview-nextra-callout-content'
      );
      expect(content).toBeInTheDocument();
      expect(content?.querySelector('p')).toHaveTextContent('Paragraph content');
    });
  });

  describe('HTML attributes', () => {
    it('passes through className', () => {
      const { container } = render(
        <Callout className="custom-class">Content</Callout>
      );
      const callout = container.querySelector('.mdx-preview-nextra-callout');
      expect(callout).toHaveClass('custom-class');
    });

    it('passes through other HTML attributes', () => {
      const { container } = render(
        <Callout data-testid="test-callout" id="my-callout">
          Content
        </Callout>
      );
      const callout = container.querySelector('.mdx-preview-nextra-callout');
      expect(callout).toHaveAttribute('data-testid', 'test-callout');
      expect(callout).toHaveAttribute('id', 'my-callout');
    });
  });
});
