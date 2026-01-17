// packages/webview-app/src/components/shims/nextra/Cards.test.tsx
// Tests for Nextra Cards component shim

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Cards } from './Cards';

describe('Nextra Cards', () => {
  describe('Cards container', () => {
    it('renders children', () => {
      render(
        <Cards>
          <Cards.Card title="Card 1" />
          <Cards.Card title="Card 2" />
        </Cards>
      );
      expect(screen.getByText('Card 1')).toBeInTheDocument();
      expect(screen.getByText('Card 2')).toBeInTheDocument();
    });

    it('applies base CSS class', () => {
      const { container } = render(
        <Cards>
          <Cards.Card title="Card" />
        </Cards>
      );
      expect(
        container.querySelector('.mdx-preview-nextra-cards')
      ).toBeInTheDocument();
    });

    it('sets CSS custom property for column count', () => {
      const { container } = render(
        <Cards num={2}>
          <Cards.Card title="Card" />
        </Cards>
      );
      const cardsEl = container.querySelector('.mdx-preview-nextra-cards');
      // CSS custom properties don't work with toHaveStyle in jsdom
      expect(cardsEl?.getAttribute('style')).toContain('--nextra-cards-num: 2');
    });

    it('defaults to 3 columns', () => {
      const { container } = render(
        <Cards>
          <Cards.Card title="Card" />
        </Cards>
      );
      const cardsEl = container.querySelector('.mdx-preview-nextra-cards');
      // CSS custom properties don't work with toHaveStyle in jsdom
      expect(cardsEl?.getAttribute('style')).toContain('--nextra-cards-num: 3');
    });

    it('passes through className', () => {
      const { container } = render(
        <Cards className="custom-cards">
          <Cards.Card title="Card" />
        </Cards>
      );
      const cardsEl = container.querySelector('.mdx-preview-nextra-cards');
      expect(cardsEl).toHaveClass('custom-cards');
    });
  });

  describe('Cards.Card', () => {
    it('renders title', () => {
      render(<Cards.Card title="My Card Title" />);
      expect(screen.getByText('My Card Title')).toBeInTheDocument();
    });

    it('renders icon when provided', () => {
      render(<Cards.Card title="Card" icon={<span data-testid="card-icon">🎉</span>} />);
      expect(screen.getByTestId('card-icon')).toBeInTheDocument();
    });

    it('renders children as content', () => {
      render(
        <Cards.Card title="Card">
          <p>Card description content</p>
        </Cards.Card>
      );
      expect(screen.getByText('Card description content')).toBeInTheDocument();
    });

    it('renders arrow when arrow prop is true', () => {
      const { container } = render(<Cards.Card title="Card" arrow />);
      expect(
        container.querySelector('.mdx-preview-nextra-card-arrow')
      ).toBeInTheDocument();
    });

    it('does not render arrow by default', () => {
      const { container } = render(<Cards.Card title="Card" />);
      expect(
        container.querySelector('.mdx-preview-nextra-card-arrow')
      ).not.toBeInTheDocument();
    });

    describe('link behavior', () => {
      it('renders as anchor when href is provided', () => {
        const { container } = render(<Cards.Card title="Card" href="/path" />);
        expect(container.querySelector('a')).toBeInTheDocument();
        expect(container.querySelector('a')).toHaveAttribute('href', '/path');
      });

      it('renders as div when no href', () => {
        const { container } = render(<Cards.Card title="Card" />);
        expect(container.querySelector('a')).not.toBeInTheDocument();
        expect(
          container.querySelector('div.mdx-preview-nextra-card')
        ).toBeInTheDocument();
      });

      it('opens external links in new tab', () => {
        const { container } = render(
          <Cards.Card title="Card" href="https://example.com" />
        );
        const link = container.querySelector('a');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      });

      it('does not add target for internal links', () => {
        const { container } = render(<Cards.Card title="Card" href="/internal" />);
        const link = container.querySelector('a');
        expect(link).not.toHaveAttribute('target');
        expect(link).not.toHaveAttribute('rel');
      });
    });

    describe('structure', () => {
      it('has header with title', () => {
        const { container } = render(<Cards.Card title="Card Title" />);
        expect(
          container.querySelector('.mdx-preview-nextra-card-header')
        ).toBeInTheDocument();
        expect(
          container.querySelector('.mdx-preview-nextra-card-title')
        ).toHaveTextContent('Card Title');
      });

      it('has icon container when icon provided', () => {
        const { container } = render(<Cards.Card title="Card" icon="📁" />);
        expect(
          container.querySelector('.mdx-preview-nextra-card-icon')
        ).toBeInTheDocument();
      });

      it('has content container when children provided', () => {
        const { container } = render(
          <Cards.Card title="Card">Content here</Cards.Card>
        );
        expect(
          container.querySelector('.mdx-preview-nextra-card-content')
        ).toBeInTheDocument();
      });

      it('does not have content container when no children', () => {
        const { container } = render(<Cards.Card title="Card" />);
        expect(
          container.querySelector('.mdx-preview-nextra-card-content')
        ).not.toBeInTheDocument();
      });
    });

    it('passes through className', () => {
      const { container } = render(
        <Cards.Card title="Card" className="custom-card" />
      );
      expect(
        container.querySelector('.mdx-preview-nextra-card')
      ).toHaveClass('custom-card');
    });

    it('passes through other HTML attributes', () => {
      const { container } = render(
        <Cards.Card title="Card" data-testid="test-card" id="my-card" />
      );
      const card = container.querySelector('.mdx-preview-nextra-card');
      expect(card).toHaveAttribute('data-testid', 'test-card');
      expect(card).toHaveAttribute('id', 'my-card');
    });
  });

  describe('compound component', () => {
    it('Cards.Card is accessible as static property', () => {
      expect(Cards.Card).toBeDefined();
      expect(typeof Cards.Card).toBe('function');
    });
  });

  describe('full example', () => {
    it('renders complete cards grid', () => {
      const { container } = render(
        <Cards num={2}>
          <Cards.Card
            icon="📚"
            title="Documentation"
            href="/docs"
            arrow
          >
            Learn how to use this feature
          </Cards.Card>
          <Cards.Card
            icon="🚀"
            title="Getting Started"
            href="/start"
          >
            Quick start guide
          </Cards.Card>
        </Cards>
      );

      // Grid container
      const grid = container.querySelector('.mdx-preview-nextra-cards');
      // CSS custom properties don't work with toHaveStyle in jsdom
      expect(grid?.getAttribute('style')).toContain('--nextra-cards-num: 2');

      // Cards
      const cards = container.querySelectorAll('.mdx-preview-nextra-card');
      expect(cards).toHaveLength(2);

      // Content
      expect(screen.getByText('Documentation')).toBeInTheDocument();
      expect(screen.getByText('Getting Started')).toBeInTheDocument();
      expect(screen.getByText('Learn how to use this feature')).toBeInTheDocument();
      expect(screen.getByText('Quick start guide')).toBeInTheDocument();
    });
  });
});
