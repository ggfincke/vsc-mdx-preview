// tests/resolution/alias-resolver.test.ts
// unit tests for framework alias resolution

import { describe, it, expect } from 'vitest';
import { resolveAlias } from '../../packages/extension-host/src/features/module-runtime/resolution/alias-resolver';

describe('resolveAlias()', () => {
  describe('Docusaurus aliases', () => {
    it('resolves @theme/Tabs to shim path', () => {
      const result = resolveAlias('@theme/Tabs', 'docusaurus', '/workspace');

      expect(result).not.toBeNull();
      expect(result).toContain('@mdx-preview/shims');
      expect(result).toContain('Tabs');
    });

    it('resolves @site/ to workspace-relative path', () => {
      const result = resolveAlias(
        '@site/src/components/Button',
        'docusaurus',
        '/workspace'
      );

      expect(result).not.toBeNull();
      expect(result).toBe('/workspace/src/components/Button');
    });
  });

  describe('Starlight aliases', () => {
    it('resolves @astrojs/starlight/components to shim path', () => {
      const result = resolveAlias(
        '@astrojs/starlight/components',
        'starlight',
        '/workspace'
      );

      expect(result).not.toBeNull();
      expect(result).toContain('@mdx-preview/shims');
    });
  });

  describe('generic and unknown aliases', () => {
    it('resolves generic shims and rejects unknown aliases', () => {
      const generic = resolveAlias('Callout', 'generic', '/workspace');
      const unknown = resolveAlias(
        '@unknown/component',
        'docusaurus',
        '/workspace'
      );

      expect(generic).toBe('@mdx-preview/shims/generic/Callout');
      expect(unknown).toBeNull();
    });
  });
});
