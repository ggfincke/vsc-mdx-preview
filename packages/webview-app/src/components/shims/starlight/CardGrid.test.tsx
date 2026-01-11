// Tests for Starlight CardGrid component shim

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CardGrid } from './CardGrid';

describe('CardGrid', () => {
  it('renders children in grid', () => {
    render(
      <CardGrid>
        <div>Card 1</div>
        <div>Card 2</div>
      </CardGrid>
    );

    expect(screen.getByText('Card 1')).toBeInTheDocument();
    expect(screen.getByText('Card 2')).toBeInTheDocument();
  });

  it('applies stagger class when stagger={true}', () => {
    const { container } = render(
      <CardGrid stagger={true}>
        <div>Card content</div>
      </CardGrid>
    );

    const gridDiv = container.querySelector('.starlight-card-grid');
    expect(gridDiv).toHaveClass('stagger');
  });

  it('does not apply stagger class by default', () => {
    const { container } = render(
      <CardGrid>
        <div>Card content</div>
      </CardGrid>
    );

    const gridDiv = container.querySelector('.starlight-card-grid');
    expect(gridDiv).not.toHaveClass('stagger');
  });
});
