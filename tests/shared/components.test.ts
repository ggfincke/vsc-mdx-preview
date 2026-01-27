// tests/shared/components.test.ts
// tests for component registry caching behavior

import { describe, it, expect } from 'vitest';
import {
  getAllGenericComponentNames,
  getGenericComponentSet,
  isGenericComponent,
  getCanonicalComponentName,
  GENERIC_COMPONENTS,
} from '@mdx-preview/shared';

describe('getAllGenericComponentNames', () => {
  it('returns same reference on subsequent calls (cached)', () => {
    const first = getAllGenericComponentNames();
    const second = getAllGenericComponentNames();
    expect(first).toBe(second);
  });

  it('includes all primary component names', () => {
    const names = getAllGenericComponentNames();
    const primaryNames = Object.keys(GENERIC_COMPONENTS);
    for (const name of primaryNames) {
      expect(names).toContain(name);
    }
  });

  it('includes all aliases', () => {
    const names = getAllGenericComponentNames();
    for (const config of Object.values(GENERIC_COMPONENTS)) {
      for (const alias of config.aliases) {
        expect(names).toContain(alias);
      }
    }
  });
});

describe('getGenericComponentSet', () => {
  it('returns same reference on subsequent calls (cached)', () => {
    const first = getGenericComponentSet();
    const second = getGenericComponentSet();
    expect(first).toBe(second);
  });

  it('contains all names from getAllGenericComponentNames', () => {
    const set = getGenericComponentSet();
    const names = getAllGenericComponentNames();
    for (const name of names) {
      expect(set.has(name)).toBe(true);
    }
  });
});

describe('isGenericComponent', () => {
  it('returns true for primary component names', () => {
    expect(isGenericComponent('Callout')).toBe(true);
    expect(isGenericComponent('Tabs')).toBe(true);
    expect(isGenericComponent('TabItem')).toBe(true);
    expect(isGenericComponent('Collapsible')).toBe(true);
    expect(isGenericComponent('CodeGroup')).toBe(true);
  });

  it('returns true for aliases', () => {
    expect(isGenericComponent('Alert')).toBe(true);
    expect(isGenericComponent('Admonition')).toBe(true);
    expect(isGenericComponent('Accordion')).toBe(true);
    expect(isGenericComponent('Details')).toBe(true);
    expect(isGenericComponent('Tab')).toBe(true);
  });

  it('returns false for unknown components', () => {
    expect(isGenericComponent('Unknown')).toBe(false);
    expect(isGenericComponent('MyCustomComponent')).toBe(false);
    expect(isGenericComponent('')).toBe(false);
  });
});

describe('getCanonicalComponentName', () => {
  it('returns same name for primary components', () => {
    expect(getCanonicalComponentName('Callout')).toBe('Callout');
    expect(getCanonicalComponentName('Tabs')).toBe('Tabs');
  });

  it('returns canonical name for aliases', () => {
    expect(getCanonicalComponentName('Alert')).toBe('Callout');
    expect(getCanonicalComponentName('Admonition')).toBe('Callout');
    expect(getCanonicalComponentName('Accordion')).toBe('Collapsible');
    expect(getCanonicalComponentName('Details')).toBe('Collapsible');
    expect(getCanonicalComponentName('Tab')).toBe('TabItem');
  });

  it('returns undefined for unknown components', () => {
    expect(getCanonicalComponentName('Unknown')).toBeUndefined();
  });
});
