// packages/webview-app/src/test/linkHandler.test.ts
// tests for link classification & handling utilities

import { describe, it, expect } from 'vitest';
import {
  classifyLink,
  isAllowedExternalScheme,
  normalizeRelativePath,
  extractAnchor,
} from '../utils/linkHandler';

describe('linkHandler', () => {
  describe('classifyLink', () => {
    describe('anchor links', () => {
      it('classifies #id as anchor', () => {
        expect(classifyLink('#section')).toBe('anchor');
      });

      it('classifies #heading-with-dashes as anchor', () => {
        expect(classifyLink('#heading-with-dashes')).toBe('anchor');
      });

      it('classifies # alone as anchor', () => {
        expect(classifyLink('#')).toBe('anchor');
      });
    });

    describe('external links', () => {
      it('classifies https:// as external', () => {
        expect(classifyLink('https://example.com')).toBe('external');
      });

      it('classifies http:// as external', () => {
        expect(classifyLink('http://example.com')).toBe('external');
      });

      it('classifies mailto: as external', () => {
        expect(classifyLink('mailto:test@example.com')).toBe('external');
      });

      it('classifies tel: as external', () => {
        expect(classifyLink('tel:+1234567890')).toBe('external');
      });

      it('classifies https with path as external', () => {
        expect(classifyLink('https://example.com/path/to/page')).toBe(
          'external'
        );
      });
    });

    describe('relative file links', () => {
      it('classifies ./file.md as relative-file', () => {
        expect(classifyLink('./file.md')).toBe('relative-file');
      });

      it('classifies ../docs/readme.mdx as relative-file', () => {
        expect(classifyLink('../docs/readme.mdx')).toBe('relative-file');
      });

      it('classifies file.html as relative-file', () => {
        expect(classifyLink('file.html')).toBe('relative-file');
      });

      it('classifies path/to/doc.md as relative-file', () => {
        expect(classifyLink('path/to/doc.md')).toBe('relative-file');
      });

      it('classifies file.htm as relative-file', () => {
        expect(classifyLink('file.htm')).toBe('relative-file');
      });
    });

    describe('unknown links', () => {
      it('classifies empty string as unknown', () => {
        expect(classifyLink('')).toBe('unknown');
      });

      it('classifies whitespace-only as unknown', () => {
        expect(classifyLink('   ')).toBe('unknown');
      });
    });

    describe('edge cases', () => {
      it('treats files with unknown extensions as relative-file', () => {
        // any relative path parses as file: URL, so it's relative-file
        expect(classifyLink('somefile.xyz')).toBe('relative-file');
      });
    });
  });

  describe('isAllowedExternalScheme', () => {
    it('allows http', () => {
      expect(isAllowedExternalScheme('http://example.com')).toBe(true);
    });

    it('allows https', () => {
      expect(isAllowedExternalScheme('https://example.com')).toBe(true);
    });

    it('allows mailto', () => {
      expect(isAllowedExternalScheme('mailto:test@example.com')).toBe(true);
    });

    it('allows tel', () => {
      expect(isAllowedExternalScheme('tel:+1234567890')).toBe(true);
    });

    it('rejects javascript', () => {
      expect(isAllowedExternalScheme('javascript:alert(1)')).toBe(false);
    });

    it('rejects data', () => {
      expect(isAllowedExternalScheme('data:text/html,test')).toBe(false);
    });

    it('rejects file', () => {
      expect(isAllowedExternalScheme('file:///etc/passwd')).toBe(false);
    });

    it('returns false for invalid URL', () => {
      expect(isAllowedExternalScheme('not a url')).toBe(false);
    });
  });

  describe('normalizeRelativePath', () => {
    it('strips fragment from path', () => {
      expect(normalizeRelativePath('file.md#heading')).toBe('file.md');
    });

    it('strips query string from path', () => {
      expect(normalizeRelativePath('file.md?v=1')).toBe('file.md');
    });

    it('strips both fragment and query', () => {
      expect(normalizeRelativePath('file.md?v=1#heading')).toBe('file.md');
    });

    it('returns path unchanged if no fragment or query', () => {
      expect(normalizeRelativePath('./docs/readme.md')).toBe(
        './docs/readme.md'
      );
    });

    it('handles fragment-only correctly', () => {
      expect(normalizeRelativePath('#heading')).toBe('');
    });
  });

  describe('extractAnchor', () => {
    it('extracts anchor from #section', () => {
      expect(extractAnchor('#section')).toBe('section');
    });

    it('extracts anchor from file.md#section', () => {
      expect(extractAnchor('file.md#section')).toBe('section');
    });

    it('returns null for path without anchor', () => {
      expect(extractAnchor('file.md')).toBeNull();
    });

    it('returns empty string for # alone', () => {
      expect(extractAnchor('#')).toBe('');
    });

    it('handles anchor with special characters', () => {
      expect(extractAnchor('#heading-with-dashes_and_underscores')).toBe(
        'heading-with-dashes_and_underscores'
      );
    });
  });
});
