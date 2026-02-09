// tests/resolution/alias-resolver.test.ts
// Unit tests for framework alias resolution

import { describe, it, expect } from 'vitest';
import {
  resolveAlias,
  isBuiltInShim,
} from '../../packages/extension-host/src/features/module-runtime/resolution/alias-resolver';

describe('resolveAlias()', () => {
  describe('Docusaurus aliases', () => {
    it('resolves @theme/Tabs to shim path', () => {
      const result = resolveAlias('@theme/Tabs', 'docusaurus', '/workspace');

      expect(result).not.toBeNull();
      expect(result).toContain('@mdx-preview/shims');
      expect(result).toContain('Tabs');
    });

    it('resolves @theme/TabItem to shim path', () => {
      const result = resolveAlias('@theme/TabItem', 'docusaurus', '/workspace');

      expect(result).not.toBeNull();
      expect(result).toContain('@mdx-preview/shims');
    });

    it('resolves @site/ to workspace-relative path', () => {
      const result = resolveAlias('@site/src/components/Button', 'docusaurus', '/workspace');

      expect(result).not.toBeNull();
      expect(result).toBe('/workspace/src/components/Button');
    });

    it('returns null for @docusaurus/ internal imports', () => {
      const result = resolveAlias('@docusaurus/core', 'docusaurus', '/workspace');

      expect(result).toBeNull();
    });
  });

  describe('Starlight aliases', () => {
    it('resolves @astrojs/starlight/components to shim path', () => {
      const result = resolveAlias('@astrojs/starlight/components', 'starlight', '/workspace');

      expect(result).not.toBeNull();
      expect(result).toContain('@mdx-preview/shims');
    });
  });

  describe('generic framework', () => {
    it('returns null for generic framework (no aliases)', () => {
      const result = resolveAlias('@theme/Tabs', 'generic', '/workspace');

      expect(result).toBeNull();
    });

    it('returns null for any import with generic framework', () => {
      expect(resolveAlias('react', 'generic', '/workspace')).toBeNull();
      expect(resolveAlias('./Button', 'generic', '/workspace')).toBeNull();
    });
  });

  describe('unknown aliases', () => {
    it('returns null for unknown alias', () => {
      const result = resolveAlias('@unknown/component', 'docusaurus', '/workspace');

      expect(result).toBeNull();
    });
  });
});

describe('isBuiltInShim()', () => {
  it('returns true for paths starting with @mdx-preview/shims', () => {
    expect(isBuiltInShim('@mdx-preview/shims/docusaurus/Tabs')).toBe(true);
    expect(isBuiltInShim('@mdx-preview/shims/generic/Callout')).toBe(true);
  });

  it('returns false for regular paths', () => {
    expect(isBuiltInShim('./components/Button')).toBe(false);
    expect(isBuiltInShim('react')).toBe(false);
    expect(isBuiltInShim('/workspace/src/Button.tsx')).toBe(false);
  });
});
