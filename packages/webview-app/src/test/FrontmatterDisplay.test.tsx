// packages/webview-app/src/test/FrontmatterDisplay.test.tsx
// tests for FrontmatterDisplay component

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { FrontmatterDisplay } from '../components/FrontmatterDisplay';

describe('FrontmatterDisplay', () => {
  describe('empty frontmatter', () => {
    it('returns null for empty object', () => {
      const { container } = render(<FrontmatterDisplay frontmatter={{}} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('structure', () => {
    it('renders details element', () => {
      render(<FrontmatterDisplay frontmatter={{ title: 'Test' }} />);

      const details = document.querySelector('details.frontmatter-display');
      expect(details).toBeInTheDocument();
    });

    it('renders summary with "Frontmatter" label', () => {
      render(<FrontmatterDisplay frontmatter={{ title: 'Test' }} />);

      expect(screen.getByText('Frontmatter')).toBeInTheDocument();
    });

    it('displays entry count badge', () => {
      render(
        <FrontmatterDisplay
          frontmatter={{ title: 'Test', author: 'John', date: '2024-01-01' }}
        />
      );

      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('is collapsed by default', () => {
      render(<FrontmatterDisplay frontmatter={{ title: 'Test' }} />);

      const details = document.querySelector('details');
      expect(details).not.toHaveAttribute('open');
    });
  });

  describe('expand/collapse', () => {
    it('expands when summary is clicked', async () => {
      const user = userEvent.setup();
      render(<FrontmatterDisplay frontmatter={{ title: 'Test' }} />);

      const summary = screen.getByText('Frontmatter');
      await user.click(summary);

      const details = document.querySelector('details');
      expect(details).toHaveAttribute('open');
    });
  });

  describe('value formatting', () => {
    it('renders string values', () => {
      render(<FrontmatterDisplay frontmatter={{ title: 'My Title' }} />);

      expect(screen.getByText('title')).toBeInTheDocument();
      expect(screen.getByText('My Title')).toBeInTheDocument();
    });

    it('renders number values', () => {
      render(<FrontmatterDisplay frontmatter={{ count: 42 }} />);

      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('renders boolean true as "true"', () => {
      render(<FrontmatterDisplay frontmatter={{ published: true }} />);

      expect(screen.getByText('true')).toBeInTheDocument();
    });

    it('renders boolean false as "false"', () => {
      render(<FrontmatterDisplay frontmatter={{ draft: false }} />);

      expect(screen.getByText('false')).toBeInTheDocument();
    });

    it('renders arrays as comma-separated values', () => {
      render(
        <FrontmatterDisplay
          frontmatter={{ tags: ['react', 'mdx', 'vscode'] }}
        />
      );

      expect(screen.getByText('react, mdx, vscode')).toBeInTheDocument();
    });

    it('renders objects as formatted JSON in pre element', () => {
      render(
        <FrontmatterDisplay
          frontmatter={{ config: { theme: 'dark', fontSize: 14 } }}
        />
      );

      const pre = document.querySelector('pre.frontmatter-code');
      expect(pre).toBeInTheDocument();
      expect(pre?.textContent).toContain('"theme": "dark"');
    });

    it('renders null as empty string', () => {
      render(<FrontmatterDisplay frontmatter={{ empty: null }} />);

      const dd = document.querySelector('.frontmatter-value');
      expect(dd?.textContent).toBe('');
    });

    it('renders undefined as empty string', () => {
      render(<FrontmatterDisplay frontmatter={{ undef: undefined }} />);

      const values = document.querySelectorAll('.frontmatter-value');
      // find the one for 'undef' key
      const undefValue = Array.from(values).find(
        (v) => v.previousElementSibling?.textContent === 'undef'
      );
      expect(undefValue?.textContent).toBe('');
    });
  });

  describe('multiple entries', () => {
    it('renders all entries', () => {
      render(
        <FrontmatterDisplay
          frontmatter={{
            title: 'Test',
            author: 'Jane',
            date: '2024-01-15',
          }}
        />
      );

      expect(screen.getByText('title')).toBeInTheDocument();
      expect(screen.getByText('author')).toBeInTheDocument();
      expect(screen.getByText('date')).toBeInTheDocument();
    });
  });
});
