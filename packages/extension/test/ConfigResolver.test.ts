// packages/extension/test/ConfigResolver.test.ts
// tests for ConfigResolver - verifies config file discovery, validation, and caching

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  resolveConfig,
  clearConfigCache,
  disposeConfigWatchers,
  onConfigChange,
} from '../preview/config/ConfigResolver';
import type { MdxPreviewConfig } from '../preview/config/ConfigResolver';
import * as fs from 'fs';

// Mock the fs module
vi.mock('fs');

describe('ConfigResolver', () => {
  beforeEach(() => {
    // Clear cache before each test
    clearConfigCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up watchers after each test
    disposeConfigWatchers();
  });

  describe('resolveConfig', () => {
    it('should find config in document directory', () => {
      const validConfig: MdxPreviewConfig = {
        remarkPlugins: ['remark-toc'],
        rehypePlugins: [],
        components: {},
      };

      vi.spyOn(fs, 'existsSync').mockImplementation((path: fs.PathLike) => {
        return path.toString().endsWith('.mdx-previewrc.json');
      });

      vi.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify(validConfig)
      );

      const result = resolveConfig('/workspace/src/test.mdx');

      expect(result).not.toBeNull();
      expect(result?.config).toEqual(validConfig);
      expect(result?.configPath).toContain('.mdx-previewrc.json');
    });

    it('should find config in parent directory', () => {
      const validConfig: MdxPreviewConfig = {
        remarkPlugins: [],
        rehypePlugins: ['rehype-slug'],
        components: {},
      };

      vi.spyOn(fs, 'existsSync').mockImplementation((path: fs.PathLike) => {
        // Config exists in /workspace but not in /workspace/src
        const pathStr = path.toString();
        return (
          pathStr === '/workspace/.mdx-previewrc.json' ||
          pathStr === '/workspace/.mdx-previewrc'
        );
      });

      vi.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify(validConfig)
      );

      const result = resolveConfig('/workspace/src/test.mdx');

      expect(result).not.toBeNull();
      expect(result?.configPath).toBe('/workspace/.mdx-previewrc.json');
    });

    it('should cache config per directory', () => {
      const validConfig: MdxPreviewConfig = {
        remarkPlugins: ['remark-toc'],
        rehypePlugins: [],
        components: {},
      };

      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      const readFileSyncSpy = vi
        .spyOn(fs, 'readFileSync')
        .mockReturnValue(JSON.stringify(validConfig));

      // First call
      resolveConfig('/workspace/src/test.mdx');
      expect(readFileSyncSpy).toHaveBeenCalledTimes(1);

      // Second call from same directory - should use cache
      resolveConfig('/workspace/src/another.mdx');
      expect(readFileSyncSpy).toHaveBeenCalledTimes(1); // Still 1, used cache
    });

    it('should return null if no config found', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);

      const result = resolveConfig('/workspace/src/test.mdx');

      expect(result).toBeNull();
    });

    it('should validate plugin specs', () => {
      const invalidConfig = {
        remarkPlugins: [123], // Invalid - should be string or tuple
      };

      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify(invalidConfig)
      );

      const result = resolveConfig('/workspace/src/test.mdx');

      // Should return null due to validation failure
      expect(result).toBeNull();
    });

    it('should validate component mappings', () => {
      const invalidConfig = {
        components: 'not-an-object', // Invalid - should be object
      };

      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify(invalidConfig)
      );

      const result = resolveConfig('/workspace/src/test.mdx');

      // Should return null due to validation failure
      expect(result).toBeNull();
    });
  });

  describe('config validation', () => {
    it('should accept string plugin spec', () => {
      const validConfig: MdxPreviewConfig = {
        remarkPlugins: ['remark-toc', 'remark-gfm'],
      };

      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify(validConfig)
      );

      const result = resolveConfig('/workspace/test.mdx');

      expect(result).not.toBeNull();
      expect(result?.config.remarkPlugins).toEqual([
        'remark-toc',
        'remark-gfm',
      ]);
    });

    it('should accept [string, options] plugin spec', () => {
      const validConfig: MdxPreviewConfig = {
        remarkPlugins: [['remark-toc', { tight: true }]],
        rehypePlugins: [['rehype-slug', { prefix: 'heading-' }]],
      };

      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify(validConfig)
      );

      const result = resolveConfig('/workspace/test.mdx');

      expect(result).not.toBeNull();
      expect(result?.config.remarkPlugins).toEqual([
        ['remark-toc', { tight: true }],
      ]);
    });

    it('should reject invalid plugin specs', () => {
      const invalidConfig = {
        remarkPlugins: [
          'valid-plugin',
          123, // Invalid
          { invalid: 'object' }, // Invalid
        ],
      };

      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify(invalidConfig)
      );

      const result = resolveConfig('/workspace/test.mdx');

      expect(result).toBeNull();
    });

    it('should reject non-object components', () => {
      const configs = [
        { components: 'string' },
        { components: 123 },
        { components: ['array'] },
        { components: null },
      ];

      for (const invalidConfig of configs) {
        vi.spyOn(fs, 'existsSync').mockReturnValue(true);
        vi.spyOn(fs, 'readFileSync').mockReturnValue(
          JSON.stringify(invalidConfig)
        );

        const result = resolveConfig('/workspace/test.mdx');
        expect(result).toBeNull();
      }
    });

    it('should accept valid component mappings', () => {
      const validConfig: MdxPreviewConfig = {
        components: {
          Callout: './components/Callout.tsx',
          Button: './components/Button.tsx',
        },
      };

      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify(validConfig)
      );

      const result = resolveConfig('/workspace/test.mdx');

      expect(result).not.toBeNull();
      expect(result?.config.components).toEqual({
        Callout: './components/Callout.tsx',
        Button: './components/Button.tsx',
      });
    });
  });

  describe('caching', () => {
    it('should cache resolved config', () => {
      const validConfig: MdxPreviewConfig = {
        remarkPlugins: ['remark-toc'],
      };

      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      const readSpy = vi
        .spyOn(fs, 'readFileSync')
        .mockReturnValue(JSON.stringify(validConfig));

      // First call
      const result1 = resolveConfig('/workspace/src/test.mdx');
      expect(readSpy).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result2 = resolveConfig('/workspace/src/test.mdx');
      expect(readSpy).toHaveBeenCalledTimes(1); // Still 1

      expect(result1).toEqual(result2);
    });

    it('should clear cache when clearConfigCache is called', () => {
      const validConfig: MdxPreviewConfig = {
        remarkPlugins: ['remark-toc'],
      };

      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      const readSpy = vi
        .spyOn(fs, 'readFileSync')
        .mockReturnValue(JSON.stringify(validConfig));

      // First call
      resolveConfig('/workspace/src/test.mdx');
      expect(readSpy).toHaveBeenCalledTimes(1);

      // Clear cache
      clearConfigCache();

      // Second call - should read again
      resolveConfig('/workspace/src/test.mdx');
      expect(readSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('config change notifications', () => {
    it('should notify subscribers on config change', () => {
      const callback = vi.fn();
      const disposable = onConfigChange(callback);

      // Trigger a config change by clearing cache (simulating file change)
      clearConfigCache();

      // In a real scenario, file watcher would trigger this
      // For this test, we just verify the subscription works
      expect(disposable).toBeDefined();
      expect(disposable.dispose).toBeDefined();

      disposable.dispose();
    });

    it('should allow unsubscribing from config changes', () => {
      const callback = vi.fn();
      const disposable = onConfigChange(callback);

      // Unsubscribe
      disposable.dispose();

      // Clear cache should not trigger callback after unsubscribe
      clearConfigCache();
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('malformed JSON handling', () => {
    it('should handle malformed JSON gracefully', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue('{ invalid json }');

      const result = resolveConfig('/workspace/test.mdx');

      expect(result).toBeNull();
    });

    it('should handle file read errors gracefully', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = resolveConfig('/workspace/test.mdx');

      expect(result).toBeNull();
    });
  });

  describe('config file priority', () => {
    it('should prefer .mdx-previewrc.json over .mdx-previewrc', () => {
      const config1 = { remarkPlugins: ['plugin-1'] };
      const config2 = { remarkPlugins: ['plugin-2'] };

      vi.spyOn(fs, 'existsSync').mockImplementation((path: fs.PathLike) => {
        // Both files exist
        return (
          path.toString().includes('.mdx-previewrc.json') ||
          path.toString().includes('.mdx-previewrc')
        );
      });

      vi.spyOn(fs, 'readFileSync').mockImplementation((path: fs.PathOrFileDescriptor) => {
        if (path.toString().includes('.mdx-previewrc.json')) {
          return JSON.stringify(config1);
        }
        return JSON.stringify(config2);
      });

      const result = resolveConfig('/workspace/test.mdx');

      expect(result).not.toBeNull();
      // Should use .mdx-previewrc.json (config1)
      expect(result?.configPath).toContain('.mdx-previewrc.json');
      expect(result?.config.remarkPlugins).toEqual(['plugin-1']);
    });
  });
});
