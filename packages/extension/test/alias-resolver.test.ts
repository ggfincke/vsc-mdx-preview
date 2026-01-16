// packages/extension/test/alias-resolver.test.ts
// tests for framework-specific import alias resolution

import { describe, it, expect } from 'vitest';
import {
  resolveAlias,
  getAliasesForFramework,
  isBuiltInShim,
  parseShimPath,
  SHIM_PREFIX,
} from '../framework/alias-resolver';

describe('alias-resolver', () => {
  describe('resolveAlias', () => {
    describe('Docusaurus aliases', () => {
      it('resolves @theme/Tabs to shim path', () => {
        const result = resolveAlias('@theme/Tabs', 'docusaurus', '/workspace');
        expect(result).toBe(`${SHIM_PREFIX}/docusaurus/Tabs`);
      });

      it('resolves @theme/TabItem to shim path', () => {
        const result = resolveAlias(
          '@theme/TabItem',
          'docusaurus',
          '/workspace'
        );
        expect(result).toBe(`${SHIM_PREFIX}/docusaurus/TabItem`);
      });

      it('resolves @theme/CodeBlock to shim path', () => {
        const result = resolveAlias(
          '@theme/CodeBlock',
          'docusaurus',
          '/workspace'
        );
        expect(result).toBe(`${SHIM_PREFIX}/docusaurus/CodeBlock`);
      });

      it('resolves @theme/Details to shim path', () => {
        const result = resolveAlias(
          '@theme/Details',
          'docusaurus',
          '/workspace'
        );
        expect(result).toBe(`${SHIM_PREFIX}/docusaurus/Details`);
      });

      it('returns null for unsupported @theme/ components', () => {
        const result = resolveAlias(
          '@theme/Unsupported',
          'docusaurus',
          '/workspace'
        );
        expect(result).toBeNull();
      });

      it('resolves @site/ paths to workspace paths', () => {
        const result = resolveAlias(
          '@site/components/Button',
          'docusaurus',
          '/workspace'
        );
        expect(result).toContain('/workspace');
        expect(result).toContain('components/Button');
      });

      it('returns null for @docusaurus/ paths', () => {
        const result = resolveAlias(
          '@docusaurus/Link',
          'docusaurus',
          '/workspace'
        );
        expect(result).toBeNull();
      });
    });

    describe('Starlight aliases', () => {
      it('resolves @astrojs/starlight/components to shim', () => {
        const result = resolveAlias(
          '@astrojs/starlight/components',
          'astro-starlight',
          '/workspace'
        );
        expect(result).toBe(`${SHIM_PREFIX}/starlight`);
      });

      it('resolves individual Starlight components', () => {
        const result = resolveAlias(
          '@astrojs/starlight/components/Card',
          'astro-starlight',
          '/workspace'
        );
        expect(result).toBe(`${SHIM_PREFIX}/starlight/Card`);
      });

      it('returns null for unsupported Starlight components', () => {
        // Test with a component that is NOT in FRAMEWORK_COMPONENTS.starlight
        const result = resolveAlias(
          '@astrojs/starlight/components/UnsupportedWidget',
          'astro-starlight',
          '/workspace'
        );
        expect(result).toBeNull();
      });
    });

    describe('Next.js aliases', () => {
      it('resolves next/image to shim path', () => {
        const result = resolveAlias('next/image', 'nextjs', '/workspace');
        expect(result).toBe(`${SHIM_PREFIX}/nextjs/Image`);
      });

      it('resolves next/link to shim path', () => {
        const result = resolveAlias('next/link', 'nextjs', '/workspace');
        expect(result).toBe(`${SHIM_PREFIX}/nextjs/Link`);
      });

      it('returns null for other next/ imports', () => {
        const result = resolveAlias('next/router', 'nextjs', '/workspace');
        expect(result).toBeNull();
      });
    });

    describe('generic framework', () => {
      it('returns null for any import when framework is generic', () => {
        const result = resolveAlias('@theme/Tabs', 'generic', '/workspace');
        expect(result).toBeNull();
      });
    });
  });

  describe('getAliasesForFramework', () => {
    it('returns Docusaurus aliases for docusaurus framework', () => {
      const aliases = getAliasesForFramework('docusaurus');
      expect(aliases.length).toBeGreaterThan(0);

      // should have @theme pattern
      const hasThemePattern = aliases.some((a) =>
        a.pattern.test('@theme/Tabs')
      );
      expect(hasThemePattern).toBe(true);
    });

    it('returns Starlight aliases for astro-starlight framework', () => {
      const aliases = getAliasesForFramework('astro-starlight');
      expect(aliases.length).toBeGreaterThan(0);

      // should have @astrojs/starlight pattern
      const hasStarlightPattern = aliases.some((a) =>
        a.pattern.test('@astrojs/starlight/components')
      );
      expect(hasStarlightPattern).toBe(true);
    });

    it('returns Next.js aliases for nextjs framework', () => {
      const aliases = getAliasesForFramework('nextjs');
      expect(aliases.length).toBeGreaterThan(0);

      // should have next/image pattern
      const hasNextImagePattern = aliases.some((a) =>
        a.pattern.test('next/image')
      );
      expect(hasNextImagePattern).toBe(true);
    });

    it('returns empty array for generic framework', () => {
      const aliases = getAliasesForFramework('generic');
      expect(aliases).toHaveLength(0);
    });
  });

  describe('isBuiltInShim', () => {
    it('returns true for shim paths', () => {
      expect(isBuiltInShim(`${SHIM_PREFIX}/docusaurus/Tabs`)).toBe(true);
      expect(isBuiltInShim(`${SHIM_PREFIX}/starlight`)).toBe(true);
      expect(isBuiltInShim(`${SHIM_PREFIX}/nextjs/Image`)).toBe(true);
    });

    it('returns false for non-shim paths', () => {
      expect(isBuiltInShim('./components/Button')).toBe(false);
      expect(isBuiltInShim('react')).toBe(false);
      expect(isBuiltInShim('/workspace/src/file.ts')).toBe(false);
    });
  });

  describe('parseShimPath', () => {
    it('parses single-component shim path', () => {
      const result = parseShimPath(`${SHIM_PREFIX}/starlight`);
      expect(result).toEqual({ framework: 'starlight', component: '*' });
    });

    it('parses component-specific shim path', () => {
      const result = parseShimPath(`${SHIM_PREFIX}/docusaurus/Tabs`);
      expect(result).toEqual({ framework: 'docusaurus', component: 'Tabs' });
    });

    it('returns null for non-shim paths', () => {
      const result = parseShimPath('./components/Button');
      expect(result).toBeNull();
    });

    it('returns null for paths with too many segments', () => {
      const result = parseShimPath(`${SHIM_PREFIX}/a/b/c`);
      expect(result).toBeNull();
    });
  });

  describe('edge cases', () => {
    describe('empty and invalid inputs', () => {
      it('returns null for empty string', () => {
        const result = resolveAlias('', 'docusaurus', '/workspace');
        expect(result).toBeNull();
      });

      it('returns null for whitespace-only string', () => {
        const result = resolveAlias('   ', 'docusaurus', '/workspace');
        expect(result).toBeNull();
      });

      it('returns null for plain string without pattern', () => {
        const result = resolveAlias('react', 'docusaurus', '/workspace');
        expect(result).toBeNull();
      });

      it('returns null for path without @ prefix', () => {
        const result = resolveAlias('theme/Tabs', 'docusaurus', '/workspace');
        expect(result).toBeNull();
      });
    });

    describe('case sensitivity', () => {
      it('does not match uppercase @THEME', () => {
        const result = resolveAlias('@THEME/Tabs', 'docusaurus', '/workspace');
        // regex is case-sensitive, so this should not match
        expect(result).toBeNull();
      });

      it('does not match mixed case @Theme', () => {
        const result = resolveAlias('@Theme/Tabs', 'docusaurus', '/workspace');
        expect(result).toBeNull();
      });

      it('does not match lowercase next/IMAGE', () => {
        const result = resolveAlias('next/IMAGE', 'nextjs', '/workspace');
        // exact match required
        expect(result).toBeNull();
      });

      it('matches exact case for components', () => {
        // @theme/tabs (lowercase) should not match Tabs
        const result = resolveAlias('@theme/tabs', 'docusaurus', '/workspace');
        // tabs is not in supportedShims (case-sensitive)
        expect(result).toBeNull();
      });
    });

    describe('path edge cases', () => {
      it('handles @site path with nested directories', () => {
        const result = resolveAlias(
          '@site/src/components/Button',
          'docusaurus',
          '/workspace'
        );
        expect(result).toContain('/workspace');
        expect(result).toContain('src/components/Button');
      });

      it('handles @site path with dots', () => {
        const result = resolveAlias(
          '@site/components/Button.tsx',
          'docusaurus',
          '/workspace'
        );
        expect(result).toContain('Button.tsx');
      });

      it('handles workspace root with trailing slash', () => {
        const result = resolveAlias(
          '@site/components/Button',
          'docusaurus',
          '/workspace/'
        );
        // path.join should normalize
        expect(result).toBeTruthy();
      });

      it('handles @theme with extra path segments', () => {
        // @theme/Tabs/extra should not match (not a valid component name)
        const result = resolveAlias(
          '@theme/Tabs/extra',
          'docusaurus',
          '/workspace'
        );
        // the component name would be "Tabs/extra" which is not in supportedShims
        expect(result).toBeNull();
      });
    });

    describe('Starlight specific edge cases', () => {
      it('handles exact @astrojs/starlight/components match', () => {
        const result = resolveAlias(
          '@astrojs/starlight/components',
          'astro-starlight',
          '/workspace'
        );
        expect(result).toBe(`${SHIM_PREFIX}/starlight`);
      });

      it('returns null for unsupported Starlight components', () => {
        // Test with a component that is NOT in FRAMEWORK_COMPONENTS.starlight
        const result = resolveAlias(
          '@astrojs/starlight/components/UnknownComponent',
          'astro-starlight',
          '/workspace'
        );
        expect(result).toBeNull();
      });

      it('resolves Code component', () => {
        // Code IS in the supportedShims list (via FRAMEWORK_COMPONENTS.starlight)
        const result = resolveAlias(
          '@astrojs/starlight/components/Code',
          'astro-starlight',
          '/workspace'
        );
        expect(result).toBe(`${SHIM_PREFIX}/starlight/Code`);
      });

      it('resolves FileTree component', () => {
        // FileTree IS in the supportedShims list (via FRAMEWORK_COMPONENTS.starlight)
        const result = resolveAlias(
          '@astrojs/starlight/components/FileTree',
          'astro-starlight',
          '/workspace'
        );
        expect(result).toBe(`${SHIM_PREFIX}/starlight/FileTree`);
      });
    });

    describe('cross-framework behavior', () => {
      it('does not resolve @theme when framework is nextjs', () => {
        const result = resolveAlias('@theme/Tabs', 'nextjs', '/workspace');
        expect(result).toBeNull();
      });

      it('does not resolve next/image when framework is docusaurus', () => {
        const result = resolveAlias('next/image', 'docusaurus', '/workspace');
        expect(result).toBeNull();
      });

      it('does not resolve starlight components when framework is docusaurus', () => {
        const result = resolveAlias(
          '@astrojs/starlight/components',
          'docusaurus',
          '/workspace'
        );
        expect(result).toBeNull();
      });
    });

    describe('isBuiltInShim edge cases', () => {
      it('returns false for empty string', () => {
        expect(isBuiltInShim('')).toBe(false);
      });

      it('returns false for partial prefix match', () => {
        expect(isBuiltInShim('@mdx-preview')).toBe(false);
      });

      it('returns true for exact prefix with path', () => {
        expect(isBuiltInShim(`${SHIM_PREFIX}/test`)).toBe(true);
      });

      it('returns false for similar but different prefix', () => {
        expect(isBuiltInShim('@mdx-preview-other/shims/test')).toBe(false);
      });
    });

    describe('alias resolution behavior', () => {
      // Note: The current alias-resolver does single-level resolution
      // These tests document the expected behavior for potential future enhancements

      it('does not follow alias chains (single-level resolution)', () => {
        // Alias resolution is direct mapping, not chained
        // @theme/Tabs maps directly to shim, no intermediate aliases
        const result = resolveAlias('@theme/Tabs', 'docusaurus', '/workspace');
        expect(result).toBe(`${SHIM_PREFIX}/docusaurus/Tabs`);

        // Trying to resolve the result would return null (it's not an alias)
        const chainResult = resolveAlias(result!, 'docusaurus', '/workspace');
        expect(chainResult).toBeNull();
      });

      it('returns null for self-referencing pattern (no infinite loop)', () => {
        // Passing a shim path back to resolveAlias should return null, not loop
        const shimPath = `${SHIM_PREFIX}/docusaurus/Tabs`;
        const result = resolveAlias(shimPath, 'docusaurus', '/workspace');
        expect(result).toBeNull();
      });

      it('handles multiple @ symbols in path', () => {
        const result = resolveAlias(
          '@theme/@custom/component',
          'docusaurus',
          '/workspace'
        );
        // Component name would be "@custom/component" which is not supported
        expect(result).toBeNull();
      });

      it('handles alias with query string', () => {
        const result = resolveAlias(
          '@theme/Tabs?v=1',
          'docusaurus',
          '/workspace'
        );
        // Query strings make it not match the pattern
        expect(result).toBeNull();
      });

      it('handles alias with hash', () => {
        const result = resolveAlias(
          '@theme/Tabs#section',
          'docusaurus',
          '/workspace'
        );
        // Hash makes it not match the pattern
        expect(result).toBeNull();
      });
    });

    describe('circular reference safety', () => {
      it('resolveAlias is stateless and cannot create circular references', () => {
        // Each call is independent - no state is maintained between calls
        // This makes circular references impossible by design
        const result1 = resolveAlias('@theme/Tabs', 'docusaurus', '/workspace');
        const result2 = resolveAlias('@theme/Tabs', 'docusaurus', '/workspace');

        expect(result1).toBe(result2);
        expect(result1).toBe(`${SHIM_PREFIX}/docusaurus/Tabs`);
      });

      it('resolving shim path does not cause recursion', () => {
        // Even if someone tried to resolve a shim path, it returns null safely
        const shim = `${SHIM_PREFIX}/starlight`;
        const result = resolveAlias(shim, 'astro-starlight', '/workspace');
        expect(result).toBeNull();
      });
    });

    describe('alias chain prevention', () => {
      // These tests document that single-level resolution is intentional design
      // Alias chains (A -> B -> C) are NOT supported

      it('resolving shim path returns null (no chaining)', () => {
        // First resolve an alias
        const shimPath = resolveAlias(
          '@theme/Tabs',
          'docusaurus',
          '/workspace'
        );
        expect(shimPath).toBe(`${SHIM_PREFIX}/docusaurus/Tabs`);

        // Attempting to resolve the result returns null - no chain following
        const chainResult = resolveAlias(shimPath!, 'docusaurus', '/workspace');
        expect(chainResult).toBeNull();
      });

      it('multiple resolution calls do not accumulate state', () => {
        // Resolve several different aliases
        resolveAlias('@theme/Tabs', 'docusaurus', '/workspace');
        resolveAlias('@theme/TabItem', 'docusaurus', '/workspace');
        resolveAlias('next/image', 'nextjs', '/workspace');

        // Each call is independent - no accumulated state
        const result = resolveAlias('@theme/Tabs', 'docusaurus', '/workspace');
        expect(result).toBe(`${SHIM_PREFIX}/docusaurus/Tabs`);
      });

      it('using result as new input returns null (documents single-level)', () => {
        // Resolve to shim path
        const step1 = resolveAlias(
          '@theme/CodeBlock',
          'docusaurus',
          '/workspace'
        );
        expect(step1).toBe(`${SHIM_PREFIX}/docusaurus/CodeBlock`);

        // Use result as input - should return null (not chain)
        const step2 = resolveAlias(step1!, 'docusaurus', '/workspace');
        expect(step2).toBeNull();

        // even trying w/ different framework returns null
        const step3 = resolveAlias(step1!, 'nextjs', '/workspace');
        expect(step3).toBeNull();
      });

      it('documents why single-level resolution is correct design', () => {
        // Single-level resolution is intentional because:
        // 1. Shim paths are final destinations (actual bundled components)
        // 2. Chains would require infinite loop protection
        // 3. Performance: O(1) vs O(n) for chain resolution

        // This test documents the expected behavior
        const originalAlias = '@astrojs/starlight/components';
        const resolved = resolveAlias(
          originalAlias,
          'astro-starlight',
          '/workspace'
        );
        expect(resolved).toBe(`${SHIM_PREFIX}/starlight`);

        // Resolved path is final - no further resolution
        expect(
          resolveAlias(resolved!, 'astro-starlight', '/workspace')
        ).toBeNull();
      });
    });

    describe('circular reference expansion', () => {
      it('repeated resolution of same alias returns consistent result', () => {
        // Call same resolution 100 times - should always return same result
        const expected = `${SHIM_PREFIX}/docusaurus/Tabs`;
        for (let i = 0; i < 100; i++) {
          const result = resolveAlias(
            '@theme/Tabs',
            'docusaurus',
            '/workspace'
          );
          expect(result).toBe(expected);
        }
      });

      it('resolution cycle attempt A->B->A pattern is prevented', () => {
        // This scenario can't actually happen because:
        // 1. Aliases resolve to shim paths
        // 2. Shim paths are not valid alias inputs
        const aliasA = '@theme/Tabs';
        const resolvedA = resolveAlias(aliasA, 'docusaurus', '/workspace');
        expect(resolvedA).toBe(`${SHIM_PREFIX}/docusaurus/Tabs`);

        // The resolved path doesn't match any alias pattern
        const resolvedB = resolveAlias(resolvedA!, 'docusaurus', '/workspace');
        expect(resolvedB).toBeNull();

        // So cycle is impossible by design
      });

      it('cross-framework circular pattern attempt is safe', () => {
        // Try alternating frameworks - still no recursion
        const docu = resolveAlias('@theme/Tabs', 'docusaurus', '/workspace');
        const next1 = resolveAlias(docu!, 'nextjs', '/workspace');
        const star1 = resolveAlias(docu!, 'astro-starlight', '/workspace');

        expect(next1).toBeNull();
        expect(star1).toBeNull();
      });

      it('resolution after partial match failure returns null', () => {
        // Partial match that fails still returns null
        const unsupported = resolveAlias(
          '@theme/UnsupportedComponent',
          'docusaurus',
          '/workspace'
        );
        expect(unsupported).toBeNull();

        // Next resolution still works normally
        const supported = resolveAlias(
          '@theme/Tabs',
          'docusaurus',
          '/workspace'
        );
        expect(supported).toBe(`${SHIM_PREFIX}/docusaurus/Tabs`);
      });

      it('no state leak between frameworks', () => {
        // resolve w/ docusaurus
        resolveAlias('@theme/Tabs', 'docusaurus', '/workspace');

        // Switch to nextjs - should work independently
        const nextResult = resolveAlias('next/image', 'nextjs', '/workspace');
        expect(nextResult).toBe(`${SHIM_PREFIX}/nextjs/Image`);

        // Switch to starlight - should also work independently
        const starlightResult = resolveAlias(
          '@astrojs/starlight/components',
          'astro-starlight',
          '/workspace'
        );
        expect(starlightResult).toBe(`${SHIM_PREFIX}/starlight`);

        // Back to docusaurus - unchanged
        const docuResult = resolveAlias(
          '@theme/Tabs',
          'docusaurus',
          '/workspace'
        );
        expect(docuResult).toBe(`${SHIM_PREFIX}/docusaurus/Tabs`);
      });
    });

    describe('additional edge cases', () => {
      it('handles very long path segments', () => {
        // Create a very long component name (1000+ chars)
        const longName = 'A'.repeat(1001);
        const longPath = `@theme/${longName}`;

        // Should not crash, returns null (not a supported shim)
        const result = resolveAlias(longPath, 'docusaurus', '/workspace');
        expect(result).toBeNull();
      });

      it('handles unicode in component names', () => {
        // Unicode component names
        const result1 = resolveAlias(
          '@theme/日本語',
          'docusaurus',
          '/workspace'
        );
        expect(result1).toBeNull(); // Not a supported shim

        const result2 = resolveAlias('@theme/Тест', 'docusaurus', '/workspace');
        expect(result2).toBeNull();

        const result3 = resolveAlias(
          '@theme/テスト',
          'docusaurus',
          '/workspace'
        );
        expect(result3).toBeNull();
      });

      it('handles unicode in workspace root', () => {
        // Unicode workspace path
        const result = resolveAlias(
          '@site/components/Button',
          'docusaurus',
          '/Users/日本語/workspace'
        );
        expect(result).toContain('/Users/日本語/workspace');
        expect(result).toContain('components/Button');
      });

      it('handles empty workspace root', () => {
        // Empty workspace root - path.join handles this
        const result = resolveAlias(
          '@site/components/Button',
          'docusaurus',
          ''
        );
        expect(result).toBe('components/Button');
      });
    });
  });
});
