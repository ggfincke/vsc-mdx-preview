// Tests for Next.js Link component shim

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Link } from './Link';

describe('Link', () => {
  describe('href resolution', () => {
    it('renders with string href', () => {
      render(<Link href="/about">About</Link>);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/about');
    });

    it('resolves pathname from object', () => {
      render(<Link href={{ pathname: '/docs' }}>Docs</Link>);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/docs');
    });

    it('adds query string from href.query', () => {
      render(
        <Link href={{ pathname: '/search', query: { q: 'test', page: '1' } }}>
          Search
        </Link>
      );

      const link = screen.getByRole('link');
      const href = link.getAttribute('href');
      expect(href).toContain('q=test');
      expect(href).toContain('page=1');
    });

    it('adds hash with # prefix', () => {
      render(
        <Link href={{ pathname: '/page', hash: '#section' }}>Section</Link>
      );

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/page#section');
    });

    it('adds hash without # prefix (prepends #)', () => {
      render(
        <Link href={{ pathname: '/page', hash: 'section' }}>Section</Link>
      );

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/page#section');
    });

    it('combines pathname, query, and hash', () => {
      render(
        <Link
          href={{
            pathname: '/docs',
            query: { version: '2' },
            hash: 'api',
          }}
        >
          API Docs
        </Link>
      );

      const link = screen.getByRole('link');
      const href = link.getAttribute('href');
      expect(href).toContain('/docs');
      expect(href).toContain('version=2');
      expect(href).toContain('#api');
    });

    it('handles empty pathname with query', () => {
      render(<Link href={{ query: { id: '123' } }}>Query Only</Link>);

      const link = screen.getByRole('link');
      expect(link.getAttribute('href')).toBe('?id=123');
    });
  });

  describe('external link detection', () => {
    it('adds target="_blank" for https:// links', () => {
      render(<Link href="https://example.com">External HTTPS</Link>);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('target', '_blank');
    });

    it('adds target="_blank" for http:// links', () => {
      render(<Link href="http://example.com">External HTTP</Link>);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('target', '_blank');
    });

    it('adds target="_blank" for // protocol-relative links', () => {
      render(<Link href="//cdn.example.com/file.js">CDN Link</Link>);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('target', '_blank');
    });

    it('adds rel="noopener noreferrer" for external links', () => {
      render(<Link href="https://external.com">External</Link>);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('does not add target for internal links', () => {
      render(<Link href="/internal">Internal</Link>);

      const link = screen.getByRole('link');
      expect(link).not.toHaveAttribute('target');
    });

    it('does not add rel for internal links', () => {
      render(<Link href="/internal">Internal</Link>);

      const link = screen.getByRole('link');
      expect(link).not.toHaveAttribute('rel');
    });
  });

  describe('rendering', () => {
    it('renders children', () => {
      render(<Link href="/link">Click me</Link>);

      expect(screen.getByText('Click me')).toBeInTheDocument();
    });

    it('passes through custom className', () => {
      render(
        <Link href="/styled" className="custom-link">
          Styled Link
        </Link>
      );

      const link = screen.getByRole('link');
      expect(link).toHaveClass('custom-link');
    });

    it('renders complex children', () => {
      render(
        <Link href="/complex">
          <span>Icon</span>
          <span>Text</span>
        </Link>
      );

      expect(screen.getByText('Icon')).toBeInTheDocument();
      expect(screen.getByText('Text')).toBeInTheDocument();
    });
  });
});
