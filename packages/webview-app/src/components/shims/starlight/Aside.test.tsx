// Tests for Starlight Aside component shim

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Aside } from './Aside';

describe('Aside', () => {
  describe('rendering', () => {
    it('renders children in content area', () => {
      render(<Aside>This is important information.</Aside>);

      expect(
        screen.getByText('This is important information.')
      ).toBeInTheDocument();
    });

    it('applies starlight-aside class', () => {
      const { container } = render(<Aside>Content</Aside>);

      expect(container.querySelector('.starlight-aside')).toBeInTheDocument();
    });
  });

  describe('type handling', () => {
    it('uses "note" as default type', () => {
      const { container } = render(<Aside>Note content</Aside>);

      const aside = container.querySelector('aside');
      expect(aside).toHaveClass('starlight-aside-note');
    });

    it('applies note type class', () => {
      const { container } = render(<Aside type="note">Note</Aside>);

      const aside = container.querySelector('aside');
      expect(aside).toHaveClass('starlight-aside-note');
    });

    it('applies tip type class', () => {
      const { container } = render(<Aside type="tip">Tip</Aside>);

      const aside = container.querySelector('aside');
      expect(aside).toHaveClass('starlight-aside-tip');
    });

    it('applies caution type class', () => {
      const { container } = render(<Aside type="caution">Caution</Aside>);

      const aside = container.querySelector('aside');
      expect(aside).toHaveClass('starlight-aside-caution');
    });

    it('applies danger type class', () => {
      const { container } = render(<Aside type="danger">Danger</Aside>);

      const aside = container.querySelector('aside');
      expect(aside).toHaveClass('starlight-aside-danger');
    });
  });

  describe('title handling', () => {
    it('displays default title "Note" for note type', () => {
      render(<Aside type="note">Content</Aside>);

      expect(screen.getByText('Note')).toBeInTheDocument();
    });

    it('displays default title "Tip" for tip type', () => {
      render(<Aside type="tip">Content</Aside>);

      expect(screen.getByText('Tip')).toBeInTheDocument();
    });

    it('displays default title "Caution" for caution type', () => {
      render(<Aside type="caution">Content</Aside>);

      expect(screen.getByText('Caution')).toBeInTheDocument();
    });

    it('displays default title "Danger" for danger type', () => {
      render(<Aside type="danger">Content</Aside>);

      expect(screen.getByText('Danger')).toBeInTheDocument();
    });

    it('displays custom title when provided', () => {
      render(
        <Aside type="note" title="Important Notice">
          Content
        </Aside>
      );

      expect(screen.getByText('Important Notice')).toBeInTheDocument();
      expect(screen.queryByText('Note')).not.toBeInTheDocument();
    });
  });

  describe('icon rendering', () => {
    it('renders type-specific icon', () => {
      const { container } = render(<Aside type="note">Content</Aside>);

      const iconSpan = container.querySelector('.starlight-aside-icon');
      expect(iconSpan).toBeInTheDocument();
      // SVG is injected via dangerouslySetInnerHTML
      expect(iconSpan?.innerHTML).toContain('svg');
    });

    it('renders different icons for different types', () => {
      const { container: noteContainer } = render(
        <Aside type="note">Note</Aside>
      );
      const { container: tipContainer } = render(<Aside type="tip">Tip</Aside>);

      const noteIcon = noteContainer.querySelector('.starlight-aside-icon');
      const tipIcon = tipContainer.querySelector('.starlight-aside-icon');

      expect(noteIcon?.innerHTML).not.toBe(tipIcon?.innerHTML);
    });
  });
});
