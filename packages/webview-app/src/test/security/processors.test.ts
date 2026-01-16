// packages/webview-app/src/test/security/processors.test.ts
// tests for post-processing functions for sanitized HTML

import { describe, it, expect, beforeEach } from 'vitest';
import { processLinks, processImages } from '../../security/processors';

describe('processLinks', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  describe('external links', () => {
    it('adds target="_blank" to https:// links', () => {
      container.innerHTML = '<a href="https://example.com">Link</a>';

      processLinks(container);

      const link = container.querySelector('a');
      expect(link?.getAttribute('target')).toBe('_blank');
    });

    it('adds rel="noopener noreferrer" to https:// links', () => {
      container.innerHTML = '<a href="https://example.com">Link</a>';

      processLinks(container);

      const link = container.querySelector('a');
      expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    });

    it('adds target="_blank" to http:// links', () => {
      container.innerHTML = '<a href="http://example.com">Link</a>';

      processLinks(container);

      const link = container.querySelector('a');
      expect(link?.getAttribute('target')).toBe('_blank');
    });

    it('adds security attributes to mailto: links', () => {
      container.innerHTML = '<a href="mailto:test@example.com">Email</a>';

      processLinks(container);

      const link = container.querySelector('a');
      expect(link?.getAttribute('target')).toBe('_blank');
      expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    });

    it('adds security attributes to tel: links', () => {
      container.innerHTML = '<a href="tel:+1234567890">Phone</a>';

      processLinks(container);

      const link = container.querySelector('a');
      expect(link?.getAttribute('target')).toBe('_blank');
    });

    it('adds security attributes to relative links', () => {
      container.innerHTML = '<a href="/page">Page</a>';

      processLinks(container);

      const link = container.querySelector('a');
      expect(link?.getAttribute('target')).toBe('_blank');
      expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    });
  });

  describe('internal anchor links', () => {
    it('does not modify fragment-only links (#section)', () => {
      container.innerHTML = '<a href="#section">Section</a>';

      processLinks(container);

      const link = container.querySelector('a');
      expect(link?.getAttribute('target')).toBeNull();
      expect(link?.getAttribute('rel')).toBeNull();
    });

    it('does not modify hash-only links (#)', () => {
      container.innerHTML = '<a href="#">Top</a>';

      processLinks(container);

      const link = container.querySelector('a');
      expect(link?.getAttribute('target')).toBeNull();
    });

    it('does not modify links starting with #heading-', () => {
      container.innerHTML = '<a href="#heading-1">Heading</a>';

      processLinks(container);

      const link = container.querySelector('a');
      expect(link?.getAttribute('target')).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('skips links without href attribute', () => {
      container.innerHTML = '<a>No href</a>';

      processLinks(container);

      const link = container.querySelector('a');
      expect(link?.getAttribute('target')).toBeNull();
    });

    it('skips links with empty href', () => {
      container.innerHTML = '<a href="">Empty</a>';

      processLinks(container);

      const link = container.querySelector('a');
      expect(link?.getAttribute('target')).toBeNull();
    });

    it('handles multiple links in container', () => {
      container.innerHTML = `
        <a href="https://a.com">A</a>
        <a href="#section">Section</a>
        <a href="https://b.com">B</a>
      `;

      processLinks(container);

      const links = container.querySelectorAll('a');
      expect(links[0].getAttribute('target')).toBe('_blank');
      expect(links[1].getAttribute('target')).toBeNull();
      expect(links[2].getAttribute('target')).toBe('_blank');
    });

    it('handles nested links (though invalid HTML)', () => {
      container.innerHTML =
        '<div><p><a href="https://example.com">Deep</a></p></div>';

      processLinks(container);

      const link = container.querySelector('a');
      expect(link?.getAttribute('target')).toBe('_blank');
    });

    it('handles empty container', () => {
      container.innerHTML = '';

      // Should not throw
      expect(() => processLinks(container)).not.toThrow();
    });

    it('handles container with no links', () => {
      container.innerHTML = '<p>No links here</p>';

      // Should not throw
      expect(() => processLinks(container)).not.toThrow();
    });
  });
});

describe('processImages', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('sets cursor to zoom-in on images', () => {
    container.innerHTML = '<img src="image.png" alt="Test">';

    processImages(container);

    const img = container.querySelector('img');
    expect(img?.style.cursor).toBe('zoom-in');
  });

  it('handles multiple images', () => {
    container.innerHTML = `
      <img src="a.png" alt="A">
      <img src="b.png" alt="B">
      <img src="c.png" alt="C">
    `;

    processImages(container);

    const images = container.querySelectorAll('img');
    images.forEach((img) => {
      expect(img.style.cursor).toBe('zoom-in');
    });
  });

  it('handles images without src attribute', () => {
    container.innerHTML = '<img alt="No src">';

    // Should not throw
    expect(() => processImages(container)).not.toThrow();

    const img = container.querySelector('img');
    expect(img?.style.cursor).toBe('zoom-in');
  });

  it('handles nested images', () => {
    container.innerHTML =
      '<div><figure><img src="nested.png" alt="Nested"></figure></div>';

    processImages(container);

    const img = container.querySelector('img');
    expect(img?.style.cursor).toBe('zoom-in');
  });

  it('handles empty container', () => {
    container.innerHTML = '';

    // Should not throw
    expect(() => processImages(container)).not.toThrow();
  });

  it('handles container with no images', () => {
    container.innerHTML = '<p>No images here</p>';

    // Should not throw
    expect(() => processImages(container)).not.toThrow();
  });

  it('preserves other inline styles on images', () => {
    container.innerHTML = '<img src="image.png" style="width: 100px;">';

    processImages(container);

    const img = container.querySelector('img');
    expect(img?.style.cursor).toBe('zoom-in');
    expect(img?.style.width).toBe('100px');
  });
});
