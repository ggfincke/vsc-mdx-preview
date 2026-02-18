// tests/shared/metadata-parity.test.ts
// verify mdx-forge metadata contracts match expected canonical values
// prevent metadata drift when mdx-forge is updated (Finding F3)
// ! cross-repo parity: mirror test in mdx-forge/tests/cross-repo/metadata-contract.test.ts

import { describe, it, expect } from 'vitest';
import {
  normalizeCalloutType,
  CALLOUT_TITLES,
} from 'mdx-forge/components/generic';
import type { CalloutType } from 'mdx-forge/components/generic';

describe('mdx-forge metadata contract', () => {
  describe('callout type contract', () => {
    it('CALLOUT_TITLES has exactly the expected callout types', () => {
      const expected: CalloutType[] = [
        'note',
        'tip',
        'warning',
        'danger',
        'info',
        'caution',
        'important',
      ];
      expect(Object.keys(CALLOUT_TITLES).sort()).toEqual(
        [...expected].sort()
      );
    });

    it('CALLOUT_TITLES values are expected display labels', () => {
      expect(CALLOUT_TITLES).toEqual({
        note: 'Note',
        tip: 'Tip',
        warning: 'Warning',
        danger: 'Danger',
        info: 'Info',
        caution: 'Caution',
        important: 'Important',
      });
    });
  });

  describe('callout alias contract', () => {
    it('success resolves to tip', () => {
      expect(normalizeCalloutType('success')).toBe('tip');
    });

    it('error resolves to danger', () => {
      expect(normalizeCalloutType('error')).toBe('danger');
    });

    it('warn resolves to warning', () => {
      expect(normalizeCalloutType('warn')).toBe('warning');
    });

    it('hint resolves to tip', () => {
      expect(normalizeCalloutType('hint')).toBe('tip');
    });

    it('unknown types default to note', () => {
      expect(normalizeCalloutType('unknown')).toBe('note');
      expect(normalizeCalloutType(undefined)).toBe('note');
    });
  });
});
