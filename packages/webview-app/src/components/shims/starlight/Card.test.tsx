// Tests for Starlight Card component shim

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Card } from './Card';

describe('Card', () => {
  it('renders title in header', () => {
    render(<Card title="Test Title">Content</Card>);

    expect(screen.getByText('Test Title')).toBeInTheDocument();
    const titleElement = screen.getByText('Test Title');
    expect(titleElement).toHaveClass('mdx-preview-starlight-card-title');
  });

  it('renders icon when provided', () => {
    render(
      <Card title="Card with Icon" icon="rocket">
        Content
      </Card>
    );

    expect(screen.getByText('rocket')).toBeInTheDocument();
    const iconElement = screen.getByText('rocket');
    expect(iconElement).toHaveClass('mdx-preview-starlight-card-icon');
  });

  it('renders children in content area', () => {
    const { container } = render(
      <Card title="Card Title">Card body content</Card>
    );

    expect(screen.getByText('Card body content')).toBeInTheDocument();
    const contentDiv = container.querySelector('.mdx-preview-starlight-card-content');
    expect(contentDiv).toBeInTheDocument();
    expect(contentDiv).toHaveTextContent('Card body content');
  });

  it('does not render icon when not provided', () => {
    const { container } = render(<Card title="No Icon Card">Content</Card>);

    expect(
      container.querySelector('.mdx-preview-starlight-card-icon')
    ).not.toBeInTheDocument();
  });
});
