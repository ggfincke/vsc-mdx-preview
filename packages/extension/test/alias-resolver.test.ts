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
        // verify component not in FRAMEWORK_COMPONENTS.starlight
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

    describe('Nextra aliases', () => {
      it('resolves nextra/components to shim', () => {
        const result = resolveAlias(
          'nextra/components',
          'nextra',
          '/workspace'
        );
        expect(result).toBe(`${SHIM_PREFIX}/nextra`);
      });

      it('resolves nextra-theme-docs to shim', () => {
        const result = resolveAlias(
          'nextra-theme-docs',
          'nextra',
          '/workspace'
        );
        expect(result).toBe(`${SHIM_PREFIX}/nextra`);
      });

      it('resolves nextra-theme-docs/components to shim', () => {
        const result = resolveAlias(
          'nextra-theme-docs/components',
          'nextra',
          '/workspace'
        );
        expect(result).toBe(`${SHIM_PREFIX}/nextra`);
      });

      it('resolves individual nextra components', () => {
        const callout = resolveAlias(
          'nextra/components/Callout',
          'nextra',
          '/workspace'
        );
        expect(callout).toBe(`${SHIM_PREFIX}/nextra/Callout`);

        const tabs = resolveAlias(
          'nextra/components/Tabs',
          'nextra',
          '/workspace'
        );
        expect(tabs).toBe(`${SHIM_PREFIX}/nextra/Tabs`);

        const cards = resolveAlias(
          'nextra/components/Cards',
          'nextra',
          '/workspace'
        );
        expect(cards).toBe(`${SHIM_PREFIX}/nextra/Cards`);
      });

      it('returns null for unsupported nextra components', () => {
        const result = resolveAlias(
          'nextra/components/UnsupportedComponent',
          'nextra',
          '/workspace'
        );
        expect(result).toBeNull();
      });

      it('does not resolve nextra imports when framework is docusaurus', () => {
        const result = resolveAlias(
          'nextra/components',
          'docusaurus',
          '/workspace'
        );
        expect(result).toBeNull();
      });

      it('does not resolve nextra imports when framework is nextjs', () => {
        const result = resolveAlias(
          'nextra/components',
          'nextjs',
          '/workspace'
        );
        expect(result).toBeNull();
      });

      it('resolves all supported Nextra components', () => {
        const components = [
          'Callout',
          'Tabs',
          'Cards',
          'FileTree',
          'Steps',
          'Bleed',
        ];
        for (const component of components) {
          const result = resolveAlias(
            `nextra/components/${component}`,
            'nextra',
            '/workspace'
          );
          expect(result).toBe(`${SHIM_PREFIX}/nextra/${component}`);
        }
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

      // verify @theme pattern exists in aliases
      const hasThemePattern = aliases.some((a) =>
        a.pattern.test('@theme/Tabs')
      );
      expect(hasThemePattern).toBe(true);
    });

    it('returns Starlight aliases for astro-starlight framework', () => {
      const aliases = getAliasesForFramework('astro-starlight');
      expect(aliases.length).toBeGreaterThan(0);

      // verify @astrojs/starlight pattern exists in aliases
      const hasStarlightPattern = aliases.some((a) =>
        a.pattern.test('@astrojs/starlight/components')
      );
      expect(hasStarlightPattern).toBe(true);
    });

    it('returns Next.js aliases for nextjs framework', () => {
      const aliases = getAliasesForFramework('nextjs');
      expect(aliases.length).toBeGreaterThan(0);

      // verify next/image pattern exists in aliases
      const hasNextImagePattern = aliases.some((a) =>
        a.pattern.test('next/image')
      );
      expect(hasNextImagePattern).toBe(true);
    });

    it('returns Nextra aliases for nextra framework', () => {
      const aliases = getAliasesForFramework('nextra');
      expect(aliases.length).toBeGreaterThan(0);

      // verify nextra/components pattern exists in aliases
      const hasNextraPattern = aliases.some((a) =>
        a.pattern.test('nextra/components')
      );
      expect(hasNextraPattern).toBe(true);

      // verify nextra-theme-docs pattern exists in aliases
      const hasThemeDocsPattern = aliases.some((a) =>
        a.pattern.test('nextra-theme-docs')
      );
      expect(hasThemeDocsPattern).toBe(true);
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
        // verify case-sensitive regex matching
        expect(result).toBeNull();
      });

      it('does not match mixed case @Theme', () => {
        const result = resolveAlias('@Theme/Tabs', 'docusaurus', '/workspace');
        expect(result).toBeNull();
      });

      it('does not match lowercase next/IMAGE', () => {
        const result = resolveAlias('next/IMAGE', 'nextjs', '/workspace');
        // verify exact match required
        expect(result).toBeNull();
      });

      it('matches exact case for components', () => {
        // verify @theme/tabs (lowercase) does not match Tabs (case-sensitive)
        const result = resolveAlias('@theme/tabs', 'docusaurus', '/workspace');
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
        // verify path.join normalization
        expect(result).toBeTruthy();
      });

      it('handles @theme with extra path segments', () => {
        // verify @theme/Tabs/extra does not match (invalid component name)
        const result = resolveAlias(
          '@theme/Tabs/extra',
          'docusaurus',
          '/workspace'
        );
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
        // verify component not in FRAMEWORK_COMPONENTS.starlight
        const result = resolveAlias(
          '@astrojs/starlight/components/UnknownComponent',
          'astro-starlight',
          '/workspace'
        );
        expect(result).toBeNull();
      });

      it('resolves Code component', () => {
        // verify Code component resolution (from FRAMEWORK_COMPONENTS.starlight)
        const result = resolveAlias(
          '@astrojs/starlight/components/Code',
          'astro-starlight',
          '/workspace'
        );
        expect(result).toBe(`${SHIM_PREFIX}/starlight/Code`);
      });

      it('resolves FileTree component', () => {
        // verify FileTree component resolution (from FRAMEWORK_COMPONENTS.starlight)
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

      it('does not resolve nextra components when framework is docusaurus', () => {
        const result = resolveAlias(
          'nextra/components',
          'docusaurus',
          '/workspace'
        );
        expect(result).toBeNull();
      });

      it('does not resolve @theme when framework is nextra', () => {
        const result = resolveAlias('@theme/Tabs', 'nextra', '/workspace');
        expect(result).toBeNull();
      });

      it('does not resolve starlight components when framework is nextra', () => {
        const result = resolveAlias(
          '@astrojs/starlight/components',
          'nextra',
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
      // verify single-level resolution behavior (no chain following for future enhancements)

      it('does not follow alias chains (single-level resolution)', () => {
        // verify direct mapping: @theme/Tabs → shim (no intermediate aliases)
        const result = resolveAlias('@theme/Tabs', 'docusaurus', '/workspace');
        expect(result).toBe(`${SHIM_PREFIX}/docusaurus/Tabs`);

        // verify resolving result returns null (not an alias)
        const chainResult = resolveAlias(result!, 'docusaurus', '/workspace');
        expect(chainResult).toBeNull();
      });

      it('returns null for self-referencing pattern (no infinite loop)', () => {
        // verify shim path passed to resolveAlias returns null (prevents loop)
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
        // verify unsupported component name "@custom/component" returns null
        expect(result).toBeNull();
      });

      it('handles alias with query string', () => {
        const result = resolveAlias(
          '@theme/Tabs?v=1',
          'docusaurus',
          '/workspace'
        );
        // verify query strings prevent pattern match
        expect(result).toBeNull();
      });

      it('handles alias with hash', () => {
        const result = resolveAlias(
          '@theme/Tabs#section',
          'docusaurus',
          '/workspace'
        );
        // verify hash prevents pattern match
        expect(result).toBeNull();
      });
    });

    describe('circular reference safety', () => {
      it('resolveAlias is stateless and cannot create circular references', () => {
        // verify independent calls w/ no state (circular refs impossible by design)
        const result1 = resolveAlias('@theme/Tabs', 'docusaurus', '/workspace');
        const result2 = resolveAlias('@theme/Tabs', 'docusaurus', '/workspace');

        expect(result1).toBe(result2);
        expect(result1).toBe(`${SHIM_PREFIX}/docusaurus/Tabs`);
      });

      it('resolving shim path does not cause recursion', () => {
        // verify resolving shim path returns null safely (no recursion)
        const shim = `${SHIM_PREFIX}/starlight`;
        const result = resolveAlias(shim, 'astro-starlight', '/workspace');
        expect(result).toBeNull();
      });
    });

    describe('alias chain prevention', () => {
      // verify single-level resolution is intentional design (alias chains A→B→C not supported)

      it('resolving shim path returns null (no chaining)', () => {
        // resolve alias first
        const shimPath = resolveAlias(
          '@theme/Tabs',
          'docusaurus',
          '/workspace'
        );
        expect(shimPath).toBe(`${SHIM_PREFIX}/docusaurus/Tabs`);

        // verify resolving result returns null (no chain following)
        const chainResult = resolveAlias(shimPath!, 'docusaurus', '/workspace');
        expect(chainResult).toBeNull();
      });

      it('multiple resolution calls do not accumulate state', () => {
        // resolve several different aliases
        resolveAlias('@theme/Tabs', 'docusaurus', '/workspace');
        resolveAlias('@theme/TabItem', 'docusaurus', '/workspace');
        resolveAlias('next/image', 'nextjs', '/workspace');

        // verify each call is independent (no accumulated state)
        const result = resolveAlias('@theme/Tabs', 'docusaurus', '/workspace');
        expect(result).toBe(`${SHIM_PREFIX}/docusaurus/Tabs`);
      });

      it('using result as new input returns null (documents single-level)', () => {
        // resolve to shim path
        const step1 = resolveAlias(
          '@theme/CodeBlock',
          'docusaurus',
          '/workspace'
        );
        expect(step1).toBe(`${SHIM_PREFIX}/docusaurus/CodeBlock`);

        // verify using result as input returns null (no chaining)
        const step2 = resolveAlias(step1!, 'docusaurus', '/workspace');
        expect(step2).toBeNull();

        // verify different framework also returns null
        const step3 = resolveAlias(step1!, 'nextjs', '/workspace');
        expect(step3).toBeNull();
      });

      it('documents why single-level resolution is correct design', () => {
        // verify single-level resolution design rationale:
        // 1. shim paths are final destinations (actual bundled components)
        // 2. chains require infinite loop protection
        // 3. performance: O(1) vs O(n) for chain resolution
        const originalAlias = '@astrojs/starlight/components';
        const resolved = resolveAlias(
          originalAlias,
          'astro-starlight',
          '/workspace'
        );
        expect(resolved).toBe(`${SHIM_PREFIX}/starlight`);

        // verify resolved path is final (no further resolution)
        expect(
          resolveAlias(resolved!, 'astro-starlight', '/workspace')
        ).toBeNull();
      });
    });

    describe('circular reference expansion', () => {
      it('repeated resolution of same alias returns consistent result', () => {
        // verify same resolution called 100 times always returns same result
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
        // verify cycle prevention (aliases→shim paths, shim paths not valid inputs)
        const aliasA = '@theme/Tabs';
        const resolvedA = resolveAlias(aliasA, 'docusaurus', '/workspace');
        expect(resolvedA).toBe(`${SHIM_PREFIX}/docusaurus/Tabs`);

        // verify resolved path doesn't match any alias pattern
        const resolvedB = resolveAlias(resolvedA!, 'docusaurus', '/workspace');
        expect(resolvedB).toBeNull();
      });

      it('cross-framework circular pattern attempt is safe', () => {
        // verify alternating frameworks produces no recursion
        const docu = resolveAlias('@theme/Tabs', 'docusaurus', '/workspace');
        const next1 = resolveAlias(docu!, 'nextjs', '/workspace');
        const star1 = resolveAlias(docu!, 'astro-starlight', '/workspace');

        expect(next1).toBeNull();
        expect(star1).toBeNull();
      });

      it('resolution after partial match failure returns null', () => {
        // verify partial match failure returns null
        const unsupported = resolveAlias(
          '@theme/UnsupportedComponent',
          'docusaurus',
          '/workspace'
        );
        expect(unsupported).toBeNull();

        // verify next resolution works normally
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

        // verify switching to nextjs works independently
        const nextResult = resolveAlias('next/image', 'nextjs', '/workspace');
        expect(nextResult).toBe(`${SHIM_PREFIX}/nextjs/Image`);

        // verify switching to starlight works independently
        const starlightResult = resolveAlias(
          '@astrojs/starlight/components',
          'astro-starlight',
          '/workspace'
        );
        expect(starlightResult).toBe(`${SHIM_PREFIX}/starlight`);

        // verify switching to nextra works independently
        const nextraResult = resolveAlias(
          'nextra/components',
          'nextra',
          '/workspace'
        );
        expect(nextraResult).toBe(`${SHIM_PREFIX}/nextra`);

        // verify switching back to docusaurus remains unchanged
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
        // create very long component name (1000+ chars)
        const longName = 'A'.repeat(1001);
        const longPath = `@theme/${longName}`;

        // verify no crash & returns null (unsupported shim)
        const result = resolveAlias(longPath, 'docusaurus', '/workspace');
        expect(result).toBeNull();
      });

      it('handles unicode in component names', () => {
        // verify unicode component names return null (unsupported shims)
        const result1 = resolveAlias(
          '@theme/日本語',
          'docusaurus',
          '/workspace'
        );
        expect(result1).toBeNull();

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
        // verify unicode workspace path handling
        const result = resolveAlias(
          '@site/components/Button',
          'docusaurus',
          '/Users/日本語/workspace'
        );
        expect(result).toContain('/Users/日本語/workspace');
        expect(result).toContain('components/Button');
      });

      it('handles empty workspace root', () => {
        // verify path.join handles empty workspace root
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
