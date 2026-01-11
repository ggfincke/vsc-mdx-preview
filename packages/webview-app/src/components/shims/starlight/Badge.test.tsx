// Tests for Starlight Badge component shim

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders text content', () => {
    render(<Badge text="New Feature" />);

    expect(screen.getByText('New Feature')).toBeInTheDocument();
  });

  it('applies default variant class', () => {
    render(<Badge text="Default" />);

    const badge = screen.getByText('Default');
    expect(badge).toHaveClass('starlight-badge-default');
  });

  it('applies note variant class', () => {
    render(<Badge text="Note" variant="note" />);

    const badge = screen.getByText('Note');
    expect(badge).toHaveClass('starlight-badge-note');
  });

  it('applies tip variant class', () => {
    render(<Badge text="Tip" variant="tip" />);

    const badge = screen.getByText('Tip');
    expect(badge).toHaveClass('starlight-badge-tip');
  });

  it('applies caution variant class', () => {
    render(<Badge text="Caution" variant="caution" />);

    const badge = screen.getByText('Caution');
    expect(badge).toHaveClass('starlight-badge-caution');
  });

  it('applies danger variant class', () => {
    render(<Badge text="Danger" variant="danger" />);

    const badge = screen.getByText('Danger');
    expect(badge).toHaveClass('starlight-badge-danger');
  });

  it('applies success variant class', () => {
    render(<Badge text="Success" variant="success" />);

    const badge = screen.getByText('Success');
    expect(badge).toHaveClass('starlight-badge-success');
  });

  it('defaults to small size', () => {
    render(<Badge text="Small" />);

    const badge = screen.getByText('Small');
    expect(badge).toHaveClass('starlight-badge-small');
  });

  it('applies medium size class', () => {
    render(<Badge text="Medium" size="medium" />);

    const badge = screen.getByText('Medium');
    expect(badge).toHaveClass('starlight-badge-medium');
  });

  it('applies large size class', () => {
    render(<Badge text="Large" size="large" />);

    const badge = screen.getByText('Large');
    expect(badge).toHaveClass('starlight-badge-large');
  });

  it('applies base starlight-badge class', () => {
    render(<Badge text="Base" />);

    const badge = screen.getByText('Base');
    expect(badge).toHaveClass('starlight-badge');
  });
});
