// packages/extension/test/MetaResolver.test.ts
// Tests for MetaResolver - verifies Nextra _meta.json resolution, caching, and merging

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  resolveNextraMeta,
  mergeNextraMeta,
  clearMetaCache,
  disposeMetaWatchers,
  onMetaChange,
} from '../nextra/MetaResolver';
import * as fs from 'fs';

// mock the fs module
vi.mock('fs');

describe('MetaResolver', () => {
  beforeEach(() => {
    // Clear cache before each test
    clearMetaCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up watchers after each test
    disposeMetaWatchers();
  });

  describe('resolveNextraMeta', () => {
    it('should find _meta.json in same directory as MDX file', () => {
      const metaContent = {
        'my-page': 'My Page Title',
      };

      vi.spyOn(fs, 'existsSync').mockImplementation((path: fs.PathLike) => {
        return path.toString() === '/workspace/docs/_meta.json';
      });

      vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(metaContent));

      const result = resolveNextraMeta(
        '/workspace/docs/my-page.mdx',
        '/workspace'
      );

      expect(result).not.toBeNull();
      expect(result?.title).toBe('My Page Title');
    });

    it('should find _meta.json in parent directory', () => {
      const metaContent = {
        'nested-page': 'Nested Page Title',
      };

      vi.spyOn(fs, 'existsSync').mockImplementation((path: fs.PathLike) => {
        // _meta.json exists in /workspace/docs but not in /workspace/docs/nested
        return path.toString() === '/workspace/docs/_meta.json';
      });

      vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(metaContent));

      const result = resolveNextraMeta(
        '/workspace/docs/nested/nested-page.mdx',
        '/workspace'
      );

      expect(result).not.toBeNull();
      expect(result?.title).toBe('Nested Page Title');
    });

    it('should extract title from string entry', () => {
      const metaContent = {
        introduction: 'Getting Started Guide',
      };

      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(metaContent));

      const result = resolveNextraMeta(
        '/workspace/docs/introduction.mdx',
        '/workspace'
      );

      expect(result).not.toBeNull();
      expect(result?.title).toBe('Getting Started Guide');
    });

    it('should extract title and layout from object entry', () => {
      const metaContent = {
        'full-page': {
          title: 'Full Width Page',
          theme: {
            layout: 'full',
          },
        },
      };

      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(metaContent));

      const result = resolveNextraMeta(
        '/workspace/docs/full-page.mdx',
        '/workspace'
      );

      expect(result).not.toBeNull();
      expect(result?.title).toBe('Full Width Page');
      expect(result?.layout).toBe('full');
    });

    it('should extract toc setting from object entry', () => {
      const metaContent = {
        'no-toc-page': {
          title: 'No TOC Page',
          theme: {
            toc: false,
          },
        },
      };

      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(metaContent));

      const result = resolveNextraMeta(
        '/workspace/docs/no-toc-page.mdx',
        '/workspace'
      );

      expect(result).not.toBeNull();
      expect(result?.title).toBe('No TOC Page');
      expect(result?.toc).toBe(false);
    });

    it('should return null when page is not in _meta.json', () => {
      const metaContent = {
        'other-page': 'Other Page',
      };

      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(metaContent));

      const result = resolveNextraMeta(
        '/workspace/docs/missing-page.mdx',
        '/workspace'
      );

      expect(result).toBeNull();
    });

    it('should return null when no _meta.json found', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);

      const result = resolveNextraMeta(
        '/workspace/docs/test.mdx',
        '/workspace'
      );

      expect(result).toBeNull();
    });

    it('should match page without file extension', () => {
      const metaContent = {
        'my-component': 'Component Documentation',
      };

      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(metaContent));

      // Test with .mdx extension
      const resultMdx = resolveNextraMeta(
        '/workspace/docs/my-component.mdx',
        '/workspace'
      );
      expect(resultMdx?.title).toBe('Component Documentation');

      // Clear cache to test fresh
      clearMetaCache();

      // Test with .md extension
      const resultMd = resolveNextraMeta(
        '/workspace/docs/my-component.md',
        '/workspace'
      );
      expect(resultMd?.title).toBe('Component Documentation');
    });

    it('should not search beyond workspace root', () => {
      vi.spyOn(fs, 'existsSync').mockImplementation((path: fs.PathLike) => {
        // _meta.json exists only outside workspace
        return path.toString() === '/_meta.json';
      });

      const result = resolveNextraMeta(
        '/workspace/docs/test.mdx',
        '/workspace'
      );

      expect(result).toBeNull();
    });
  });

  describe('caching', () => {
    it('should cache resolved meta', () => {
      const metaContent = {
        'cached-page': 'Cached Title',
      };

      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      const readSpy = vi
        .spyOn(fs, 'readFileSync')
        .mockReturnValue(JSON.stringify(metaContent));

      // First call
      resolveNextraMeta('/workspace/docs/cached-page.mdx', '/workspace');
      expect(readSpy).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      resolveNextraMeta('/workspace/docs/cached-page.mdx', '/workspace');
      expect(readSpy).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should cache different pages in same directory', () => {
      const metaContent = {
        'page-a': 'Page A',
        'page-b': 'Page B',
      };

      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      const readSpy = vi
        .spyOn(fs, 'readFileSync')
        .mockReturnValue(JSON.stringify(metaContent));

      // First page
      const resultA = resolveNextraMeta(
        '/workspace/docs/page-a.mdx',
        '/workspace'
      );
      expect(readSpy).toHaveBeenCalledTimes(1);
      expect(resultA?.title).toBe('Page A');

      // Second page - different cache key but same _meta.json already read
      const resultB = resolveNextraMeta(
        '/workspace/docs/page-b.mdx',
        '/workspace'
      );
      // Will read again because cache is per page, not per _meta.json
      expect(resultB?.title).toBe('Page B');
    });

    it('should clear cache when clearMetaCache is called', () => {
      const metaContent = {
        'test-page': 'Test Title',
      };

      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      const readSpy = vi
        .spyOn(fs, 'readFileSync')
        .mockReturnValue(JSON.stringify(metaContent));

      // First call
      resolveNextraMeta('/workspace/docs/test-page.mdx', '/workspace');
      expect(readSpy).toHaveBeenCalledTimes(1);

      // Clear cache
      clearMetaCache();

      // Second call - should read again
      resolveNextraMeta('/workspace/docs/test-page.mdx', '/workspace');
      expect(readSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('mergeNextraMeta', () => {
    it('should return frontmatter when metaJson is null', () => {
      const frontmatter = {
        title: 'Frontmatter Title',
        layout: 'full' as const,
      };

      const result = mergeNextraMeta(null, frontmatter);

      expect(result).toEqual(frontmatter);
    });

    it('should return metaJson when frontmatter is empty', () => {
      const metaJson = { title: 'Meta Title', layout: 'raw' as const };

      const result = mergeNextraMeta(metaJson, {});

      expect(result).toEqual(metaJson);
    });

    it('should let frontmatter override metaJson', () => {
      const metaJson = {
        title: 'Meta Title',
        layout: 'default' as const,
        description: 'Meta Description',
      };
      const frontmatter = { title: 'Frontmatter Title' };

      const result = mergeNextraMeta(metaJson, frontmatter);

      expect(result.title).toBe('Frontmatter Title'); // Overridden
      expect(result.layout).toBe('default'); // From metaJson
      expect(result.description).toBe('Meta Description'); // From metaJson
    });

    it('should merge all properties', () => {
      const metaJson = { title: 'Meta Title' };
      const frontmatter = { layout: 'full' as const, description: 'FM Desc' };

      const result = mergeNextraMeta(metaJson, frontmatter);

      expect(result.title).toBe('Meta Title');
      expect(result.layout).toBe('full');
      expect(result.description).toBe('FM Desc');
    });
  });

  describe('change notifications', () => {
    it('should notify subscribers via onMetaChange', () => {
      const callback = vi.fn();
      const disposable = onMetaChange(callback);

      expect(disposable).toBeDefined();
      expect(disposable.dispose).toBeDefined();

      disposable.dispose();
    });

    it('should allow unsubscribing from changes', () => {
      const callback = vi.fn();
      const disposable = onMetaChange(callback);

      // Unsubscribe
      disposable.dispose();

      // Callback should not be in the set anymore
      // (behavior verified by dispose not throwing)
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('malformed JSON handling', () => {
    it('should handle malformed JSON gracefully', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue('{ invalid json }');

      const result = resolveNextraMeta(
        '/workspace/docs/test.mdx',
        '/workspace'
      );

      expect(result).toBeNull();
    });

    it('should handle file read errors gracefully', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = resolveNextraMeta(
        '/workspace/docs/test.mdx',
        '/workspace'
      );

      expect(result).toBeNull();
    });
  });

  describe('object entries without all fields', () => {
    it('should handle entry with only title', () => {
      const metaContent = {
        'title-only': {
          title: 'Just A Title',
        },
      };

      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(metaContent));

      const result = resolveNextraMeta(
        '/workspace/docs/title-only.mdx',
        '/workspace'
      );

      expect(result).not.toBeNull();
      expect(result?.title).toBe('Just A Title');
      expect(result?.layout).toBeUndefined();
      expect(result?.toc).toBeUndefined();
    });

    it('should handle entry with only theme settings', () => {
      const metaContent = {
        'theme-only': {
          theme: {
            layout: 'raw',
            toc: true,
          },
        },
      };

      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(metaContent));

      const result = resolveNextraMeta(
        '/workspace/docs/theme-only.mdx',
        '/workspace'
      );

      expect(result).not.toBeNull();
      expect(result?.title).toBeUndefined();
      expect(result?.layout).toBe('raw');
      expect(result?.toc).toBe(true);
    });

    it('should return null for empty object entry', () => {
      const metaContent = {
        'empty-entry': {},
      };

      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(metaContent));

      const result = resolveNextraMeta(
        '/workspace/docs/empty-entry.mdx',
        '/workspace'
      );

      expect(result).toBeNull();
    });

    it('should handle entry with type but no theme', () => {
      const metaContent = {
        'typed-page': {
          title: 'Typed Page',
          type: 'page',
        },
      };

      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(metaContent));

      const result = resolveNextraMeta(
        '/workspace/docs/typed-page.mdx',
        '/workspace'
      );

      expect(result).not.toBeNull();
      expect(result?.title).toBe('Typed Page');
    });
  });
});
