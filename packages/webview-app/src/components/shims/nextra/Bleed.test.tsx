// packages/webview-app/src/components/shims/nextra/Bleed.test.tsx
// Tests for Nextra Bleed component shim

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Bleed } from './Bleed';

describe('Nextra Bleed', () => {
  describe('rendering', () => {
    it('renders children content', () => {
      render(<Bleed>Bleed content</Bleed>);
      expect(screen.getByText('Bleed content')).toBeInTheDocument();
    });

    it('renders as div element', () => {
      const { container } = render(<Bleed>Content</Bleed>);
      expect(container.querySelector('div.mdx-preview-nextra-bleed')).toBeInTheDocument();
    });

    it('applies base CSS class', () => {
      const { container } = render(<Bleed>Content</Bleed>);
      expect(
        container.querySelector('.mdx-preview-nextra-bleed')
      ).toBeInTheDocument();
    });
  });

  describe('full prop', () => {
    it('does not have full class by default', () => {
      const { container } = render(<Bleed>Content</Bleed>);
      const bleed = container.querySelector('.mdx-preview-nextra-bleed');
      expect(bleed).not.toHaveClass('mdx-preview-nextra-bleed-full');
    });

    it('applies full class when full={true}', () => {
      const { container } = render(<Bleed full>Content</Bleed>);
      const bleed = container.querySelector('.mdx-preview-nextra-bleed');
      expect(bleed).toHaveClass('mdx-preview-nextra-bleed-full');
    });

    it('does not apply full class when full={false}', () => {
      const { container } = render(<Bleed full={false}>Content</Bleed>);
      const bleed = container.querySelector('.mdx-preview-nextra-bleed');
      expect(bleed).not.toHaveClass('mdx-preview-nextra-bleed-full');
    });
  });

  describe('HTML attributes', () => {
    it('passes through className', () => {
      const { container } = render(<Bleed className="custom-class">Content</Bleed>);
      const bleed = container.querySelector('.mdx-preview-nextra-bleed');
      expect(bleed).toHaveClass('custom-class');
    });

    it('combines className with full class', () => {
      const { container } = render(
        <Bleed full className="custom-class">
          Content
        </Bleed>
      );
      const bleed = container.querySelector('.mdx-preview-nextra-bleed');
      expect(bleed).toHaveClass('mdx-preview-nextra-bleed-full');
      expect(bleed).toHaveClass('custom-class');
    });

    it('passes through other HTML attributes', () => {
      const { container } = render(
        <Bleed data-testid="test-bleed" id="my-bleed">
          Content
        </Bleed>
      );
      const bleed = container.querySelector('.mdx-preview-nextra-bleed');
      expect(bleed).toHaveAttribute('data-testid', 'test-bleed');
      expect(bleed).toHaveAttribute('id', 'my-bleed');
    });

    it('passes through style prop', () => {
      const { container } = render(
        <Bleed style={{ backgroundColor: 'red' }}>Content</Bleed>
      );
      const bleed = container.querySelector('.mdx-preview-nextra-bleed');
      // Use getAttribute for more reliable style checking in jsdom
      expect(bleed?.getAttribute('style')).toContain('background-color');
    });
  });

  describe('complex children', () => {
    it('renders nested elements', () => {
      const { container } = render(
        <Bleed>
          <div className="inner">
            <p>Paragraph content</p>
            <img src="image.jpg" alt="test" />
          </div>
        </Bleed>
      );
      expect(container.querySelector('.inner')).toBeInTheDocument();
      expect(screen.getByText('Paragraph content')).toBeInTheDocument();
      expect(screen.getByAltText('test')).toBeInTheDocument();
    });

    it('renders multiple children', () => {
      render(
        <Bleed>
          <p>First</p>
          <p>Second</p>
          <p>Third</p>
        </Bleed>
      );
      expect(screen.getByText('First')).toBeInTheDocument();
      expect(screen.getByText('Second')).toBeInTheDocument();
      expect(screen.getByText('Third')).toBeInTheDocument();
    });
  });
});
