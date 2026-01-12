// Tests for Docusaurus Details component shim

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { Details } from './Details';

describe('Details', () => {
  describe('rendering', () => {
    it('renders summary with default "Details" text', () => {
      render(<Details>Content</Details>);

      expect(screen.getByText('Details')).toBeInTheDocument();
    });

    it('renders custom summary text', () => {
      render(<Details summary="Click to expand">Content</Details>);

      expect(screen.getByText('Click to expand')).toBeInTheDocument();
    });

    it('renders children in content area', () => {
      render(<Details>Hidden content here</Details>);

      expect(screen.getByText('Hidden content here')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <Details className="custom-class">Content</Details>
      );

      const details = container.querySelector('details');
      expect(details).toHaveClass('docusaurus-details');
      expect(details).toHaveClass('custom-class');
    });
  });

  describe('toggle behavior', () => {
    it('starts closed by default', () => {
      const { container } = render(<Details>Content</Details>);

      const details = container.querySelector('details');
      expect(details).not.toHaveAttribute('open');
    });

    it('starts open when open={true}', () => {
      const { container } = render(<Details open={true}>Content</Details>);

      const details = container.querySelector('details');
      expect(details).toHaveAttribute('open');
    });

    it('toggles state on click', async () => {
      const user = userEvent.setup();
      const { container } = render(<Details>Content</Details>);

      const details = container.querySelector('details') as HTMLDetailsElement;
      const summary = screen.getByText('Details');

      // Initially closed
      expect(details.open).toBe(false);

      // Click to open
      await user.click(summary);
      expect(details.open).toBe(true);

      // Click to close
      await user.click(summary);
      expect(details.open).toBe(false);
    });
  });

  describe('accessibility', () => {
    it('uses native details/summary elements', () => {
      const { container } = render(
        <Details summary="Expand me">Content</Details>
      );

      expect(container.querySelector('details')).toBeInTheDocument();
      expect(container.querySelector('summary')).toBeInTheDocument();
    });

    it('renders toggle icon in summary', () => {
      const { container } = render(<Details>Content</Details>);

      const icon = container.querySelector('.details-toggle-icon');
      expect(icon).toBeInTheDocument();
      expect(icon?.querySelector('svg')).toBeInTheDocument();
    });
  });
});
