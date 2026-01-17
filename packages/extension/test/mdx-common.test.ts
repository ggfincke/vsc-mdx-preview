// packages/extension/test/mdx-common.test.ts
// Tests for MDX common utilities - frontmatter extraction

import { describe, it, expect } from 'vitest';
import { extractNextraFrontmatter } from '../transpiler/mdx/mdx-common';

describe('extractNextraFrontmatter', () => {
  describe('title extraction', () => {
    it('should extract title from frontmatter', () => {
      const frontmatter = { title: 'My Page Title' };

      const result = extractNextraFrontmatter(frontmatter);

      expect(result.title).toBe('My Page Title');
    });

    it('should prioritize sidebarTitle over title', () => {
      const frontmatter = {
        title: 'Page Title',
        sidebarTitle: 'Sidebar Title',
      };

      const result = extractNextraFrontmatter(frontmatter);

      expect(result.title).toBe('Sidebar Title');
    });

    it('should use title when sidebarTitle is not present', () => {
      const frontmatter = { title: 'Fallback Title' };

      const result = extractNextraFrontmatter(frontmatter);

      expect(result.title).toBe('Fallback Title');
    });

    it('should ignore non-string title', () => {
      const frontmatter = { title: 123 };

      const result = extractNextraFrontmatter(frontmatter);

      expect(result.title).toBeUndefined();
    });

    it('should ignore non-string sidebarTitle', () => {
      const frontmatter = {
        title: 'Valid Title',
        sidebarTitle: { invalid: 'object' },
      };

      const result = extractNextraFrontmatter(frontmatter);

      expect(result.title).toBe('Valid Title');
    });
  });

  describe('description extraction', () => {
    it('should extract description from frontmatter', () => {
      const frontmatter = { description: 'This is a page description.' };

      const result = extractNextraFrontmatter(frontmatter);

      expect(result.description).toBe('This is a page description.');
    });

    it('should ignore non-string description', () => {
      const frontmatter = { description: ['not', 'a', 'string'] };

      const result = extractNextraFrontmatter(frontmatter);

      expect(result.description).toBeUndefined();
    });
  });

  describe('layout extraction', () => {
    it('should extract layout: default', () => {
      const frontmatter = { layout: 'default' };

      const result = extractNextraFrontmatter(frontmatter);

      expect(result.layout).toBe('default');
    });

    it('should extract layout: full', () => {
      const frontmatter = { layout: 'full' };

      const result = extractNextraFrontmatter(frontmatter);

      expect(result.layout).toBe('full');
    });

    it('should extract layout: raw', () => {
      const frontmatter = { layout: 'raw' };

      const result = extractNextraFrontmatter(frontmatter);

      expect(result.layout).toBe('raw');
    });

    it('should ignore invalid layout values', () => {
      const frontmatter = { layout: 'invalid' };

      const result = extractNextraFrontmatter(frontmatter);

      expect(result.layout).toBeUndefined();
    });

    it('should ignore non-string layout', () => {
      const frontmatter = { layout: true };

      const result = extractNextraFrontmatter(frontmatter);

      expect(result.layout).toBeUndefined();
    });
  });

  describe('combined extraction', () => {
    it('should extract all fields when present', () => {
      const frontmatter = {
        title: 'Full Page',
        description: 'A comprehensive page.',
        layout: 'full',
      };

      const result = extractNextraFrontmatter(frontmatter);

      expect(result.title).toBe('Full Page');
      expect(result.description).toBe('A comprehensive page.');
      expect(result.layout).toBe('full');
    });

    it('should return empty object for empty frontmatter', () => {
      const frontmatter = {};

      const result = extractNextraFrontmatter(frontmatter);

      expect(result).toEqual({});
    });

    it('should ignore unrelated frontmatter fields', () => {
      const frontmatter = {
        title: 'Page',
        author: 'John Doe',
        date: '2024-01-01',
        tags: ['nextra', 'mdx'],
        custom: { nested: 'value' },
      };

      const result = extractNextraFrontmatter(frontmatter);

      expect(result).toEqual({ title: 'Page' });
      expect(result).not.toHaveProperty('author');
      expect(result).not.toHaveProperty('date');
      expect(result).not.toHaveProperty('tags');
      expect(result).not.toHaveProperty('custom');
    });

    it('should handle sidebarTitle with other fields', () => {
      const frontmatter = {
        title: 'Long Title for SEO',
        sidebarTitle: 'Short',
        description: 'Description here',
        layout: 'raw',
      };

      const result = extractNextraFrontmatter(frontmatter);

      expect(result.title).toBe('Short'); // sidebarTitle wins
      expect(result.description).toBe('Description here');
      expect(result.layout).toBe('raw');
    });
  });

  describe('edge cases', () => {
    it('should handle null values gracefully', () => {
      const frontmatter = {
        title: null,
        description: null,
        layout: null,
      };

      const result = extractNextraFrontmatter(
        frontmatter as unknown as Record<string, unknown>
      );

      expect(result).toEqual({});
    });

    it('should handle undefined values gracefully', () => {
      const frontmatter = {
        title: undefined,
        description: undefined,
        layout: undefined,
      };

      const result = extractNextraFrontmatter(
        frontmatter as Record<string, unknown>
      );

      expect(result).toEqual({});
    });

    it('should handle empty string values', () => {
      const frontmatter = {
        title: '',
        description: '',
        layout: '',
      };

      const result = extractNextraFrontmatter(frontmatter);

      // Empty strings are technically strings, so title/description pass
      // but layout: '' doesn't match valid enum values
      expect(result.title).toBe('');
      expect(result.description).toBe('');
      expect(result.layout).toBeUndefined();
    });
  });
});
