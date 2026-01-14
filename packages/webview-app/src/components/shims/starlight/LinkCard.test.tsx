// Tests for Starlight LinkCard component shim

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LinkCard } from './LinkCard';

describe('LinkCard', () => {
  it('renders as anchor with href', () => {
    render(<LinkCard title="Link Title" href="https://example.com" />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://example.com');
  });

  it('renders title text', () => {
    render(<LinkCard title="Documentation" href="/docs" />);

    expect(screen.getByText('Documentation')).toBeInTheDocument();
    const titleElement = screen.getByText('Documentation');
    expect(titleElement).toHaveClass('mdx-preview-starlight-link-card-title');
  });

  it('renders description when provided', () => {
    render(
      <LinkCard
        title="API Reference"
        description="Complete API documentation"
        href="/api"
      />
    );

    expect(screen.getByText('Complete API documentation')).toBeInTheDocument();
    const descElement = screen.getByText('Complete API documentation');
    expect(descElement).toHaveClass('mdx-preview-starlight-link-card-description');
  });

  it('does not render description when not provided', () => {
    const { container } = render(
      <LinkCard title="No Description" href="/link" />
    );

    expect(
      container.querySelector('.mdx-preview-starlight-link-card-description')
    ).not.toBeInTheDocument();
  });

  it('sets target="_blank" and rel="noopener noreferrer"', () => {
    render(<LinkCard title="External Link" href="https://external.com" />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders arrow icon', () => {
    const { container } = render(<LinkCard title="With Arrow" href="/arrow" />);

    const arrowSpan = container.querySelector('.mdx-preview-starlight-link-card-arrow');
    expect(arrowSpan).toBeInTheDocument();
    expect(arrowSpan?.querySelector('svg')).toBeInTheDocument();
  });

  it('applies mdx-preview-starlight-link-card class', () => {
    render(<LinkCard title="Styled Card" href="/styled" />);

    const link = screen.getByRole('link');
    expect(link).toHaveClass('mdx-preview-starlight-link-card');
  });
});
