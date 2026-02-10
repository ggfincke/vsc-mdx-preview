// tests/shared/registry-queries.test.ts
// unit tests for registry package query helpers

import { describe, it, expect } from 'vitest';
import {
  getAllGenericComponentNames,
  getGenericComponentSet,
  getPrimaryGenericComponentNames,
  getCanonicalComponentName,
  getFrameworkComponents,
  isGenericComponent,
  isFrameworkComponent,
  getGenericShimPath,
  getFrameworkShimPath,
} from 'mdx-tools/components/registry';

describe('registry queries', () => {
  it('returns generic component names including aliases', () => {
    const names = getAllGenericComponentNames();

    expect(names).toContain('Callout');
    expect(names).toContain('Alert');
    expect(names).toContain('Admonition');
  });

  it('caches generic names and set instances', () => {
    const namesA = getAllGenericComponentNames();
    const namesB = getAllGenericComponentNames();
    const setA = getGenericComponentSet();
    const setB = getGenericComponentSet();

    expect(namesA).toBe(namesB);
    expect(setA).toBe(setB);
  });

  it('returns primary generic names without aliases', () => {
    const names = getPrimaryGenericComponentNames();

    expect(names).toContain('Callout');
    expect(names).toContain('Tabs');
    expect(names).not.toContain('Alert');
  });

  it('resolves canonical names for aliases and direct names', () => {
    expect(getCanonicalComponentName('Alert')).toBe('Callout');
    expect(getCanonicalComponentName('Callout')).toBe('Callout');
    expect(getCanonicalComponentName('UnknownComponent')).toBeUndefined();
  });

  it('detects generic and framework components', () => {
    expect(isGenericComponent('Callout')).toBe(true);
    expect(isGenericComponent('Admonition')).toBe(true);
    expect(isGenericComponent('Card')).toBe(false);

    expect(isFrameworkComponent('Tabs', 'docusaurus')).toBe(true);
    expect(isFrameworkComponent('Card', 'docusaurus')).toBe(false);
    expect(isFrameworkComponent('Card')).toBe(true);
    expect(isFrameworkComponent('DoesNotExist')).toBe(false);
  });

  it('returns framework component lists', () => {
    const docusaurus = getFrameworkComponents('docusaurus');
    const starlight = getFrameworkComponents('starlight');

    expect(docusaurus).toContain('Tabs');
    expect(docusaurus).toContain('CodeBlock');
    expect(starlight).toContain('Card');
    expect(starlight).toContain('FileTree');
  });

  it('builds expected shim paths', () => {
    expect(getGenericShimPath('Callout')).toBe(
      '@mdx-preview/shims/generic/Callout'
    );
    expect(getFrameworkShimPath('docusaurus', 'Tabs')).toBe(
      '@mdx-preview/shims/docusaurus/Tabs'
    );
  });
});
