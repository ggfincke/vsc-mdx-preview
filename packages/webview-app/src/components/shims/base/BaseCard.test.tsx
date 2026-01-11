// Tests for BaseCard component

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BaseCard, CardHeader, ArrowIcon } from './BaseCard';

describe('BaseCard', () => {
  it('renders children', () => {
    render(
      <BaseCard className="test-card">
        <span>Card content</span>
      </BaseCard>
    );

    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('applies className', () => {
    const { container } = render(
      <BaseCard className="custom-card-class">Content</BaseCard>
    );

    expect(container.firstChild).toHaveClass('custom-card-class');
  });

  it('renders as div by default', () => {
    const { container } = render(
      <BaseCard className="test">Content</BaseCard>
    );

    expect(container.firstChild?.nodeName).toBe('DIV');
  });

  it('renders as anchor when as="a" and href provided', () => {
    const { container } = render(
      <BaseCard className="link-card" as="a" href="https://example.com">
        Link content
      </BaseCard>
    );

    const anchor = container.firstChild as HTMLAnchorElement;
    expect(anchor.nodeName).toBe('A');
    expect(anchor).toHaveAttribute('href', 'https://example.com');
  });

  it('renders as div when as="a" but no href', () => {
    const { container } = render(
      <BaseCard className="test" as="a">
        Content
      </BaseCard>
    );

    expect(container.firstChild?.nodeName).toBe('DIV');
  });

  it('adds target="_blank" when openInNewTab is true', () => {
    const { container } = render(
      <BaseCard className="test" as="a" href="https://example.com" openInNewTab>
        Content
      </BaseCard>
    );

    expect(container.firstChild).toHaveAttribute('target', '_blank');
    expect(container.firstChild).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('does not add target="_blank" when openInNewTab is false', () => {
    const { container } = render(
      <BaseCard className="test" as="a" href="https://example.com" openInNewTab={false}>
        Content
      </BaseCard>
    );

    expect(container.firstChild).not.toHaveAttribute('target');
    expect(container.firstChild).not.toHaveAttribute('rel');
  });

  it('spreads containerProps on container element', () => {
    const { container } = render(
      <BaseCard
        className="test"
        containerProps={{ 'data-testid': 'card', 'aria-label': 'Test card' }}
      >
        Content
      </BaseCard>
    );

    expect(container.firstChild).toHaveAttribute('data-testid', 'card');
    expect(container.firstChild).toHaveAttribute('aria-label', 'Test card');
  });
});

describe('CardHeader', () => {
  it('renders title', () => {
    render(<CardHeader title="Card Title" />);

    expect(screen.getByText('Card Title')).toBeInTheDocument();
  });

  it('renders optional icon', () => {
    render(<CardHeader title="Title" icon={<span data-testid="icon">*</span>} />);

    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('does not render icon container when no icon', () => {
    const { container } = render(<CardHeader title="Title" />);

    expect(container.querySelector('.card-icon')).not.toBeInTheDocument();
  });

  it('applies custom classNames', () => {
    const { container } = render(
      <CardHeader
        title="Title"
        className="custom-header"
        titleClassName="custom-title"
        iconClassName="custom-icon"
        icon={<span>*</span>}
      />
    );

    expect(container.querySelector('.custom-header')).toBeInTheDocument();
    expect(container.querySelector('.custom-title')).toBeInTheDocument();
    expect(container.querySelector('.custom-icon')).toBeInTheDocument();
  });

  it('uses default classNames when not specified', () => {
    const { container } = render(
      <CardHeader title="Title" icon={<span>*</span>} />
    );

    expect(container.querySelector('.card-header')).toBeInTheDocument();
    expect(container.querySelector('.card-title')).toBeInTheDocument();
    expect(container.querySelector('.card-icon')).toBeInTheDocument();
  });
});

describe('ArrowIcon', () => {
  it('renders an SVG', () => {
    const { container } = render(<ArrowIcon />);

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('has correct dimensions', () => {
    const { container } = render(<ArrowIcon />);

    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '16');
    expect(svg).toHaveAttribute('height', '16');
  });

  it('contains arrow elements', () => {
    const { container } = render(<ArrowIcon />);

    expect(container.querySelector('line')).toBeInTheDocument();
    expect(container.querySelector('polyline')).toBeInTheDocument();
  });
});
