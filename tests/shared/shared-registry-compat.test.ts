// tests/shared/shared-registry-compat.test.ts
// validate shared facade re-exports moved registry APIs

import { describe, expect, it } from 'vitest';
import {
  CALLOUT_ICONS as sharedCalloutIcons,
  getAllGenericComponentNames as getSharedGenericNames,
  normalizeCalloutType as normalizeSharedCalloutType,
} from '@mdx-preview/shared';
import {
  CALLOUT_ICONS as registryCalloutIcons,
  getAllGenericComponentNames as getRegistryGenericNames,
  normalizeCalloutType as normalizeRegistryCalloutType,
} from '@mdx-preview/registry';

describe('shared registry compatibility', () => {
  it('re-exports registry query helpers', () => {
    expect(getSharedGenericNames()).toEqual(getRegistryGenericNames());
  });

  it('re-exports callout normalization behavior', () => {
    expect(normalizeSharedCalloutType('warn')).toBe(
      normalizeRegistryCalloutType('warn')
    );
    expect(normalizeSharedCalloutType('unknown')).toBe(
      normalizeRegistryCalloutType('unknown')
    );
  });

  it('re-exports icon metadata', () => {
    expect(sharedCalloutIcons.warning).toBe(registryCalloutIcons.warning);
    expect(sharedCalloutIcons.note).toBe(registryCalloutIcons.note);
  });
});
