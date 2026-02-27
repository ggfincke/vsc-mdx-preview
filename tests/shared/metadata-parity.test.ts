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
        'summary',
        'hint',
        'success',
        'question',
        'failure',
        'bug',
        'example',
        'quote',
        'todo',
        'attention',
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
        summary: 'Summary',
        hint: 'Hint',
        success: 'Success',
        question: 'Question',
        failure: 'Failure',
        bug: 'Bug',
        example: 'Example',
        quote: 'Quote',
        todo: 'Todo',
        attention: 'Attention',
      });
    });
  });

  describe('callout alias contract', () => {
    it('abstract resolves to summary', () => {
      expect(normalizeCalloutType('abstract')).toBe('summary');
    });

    it('error resolves to danger', () => {
      expect(normalizeCalloutType('error')).toBe('danger');
    });

    it('warn resolves to warning', () => {
      expect(normalizeCalloutType('warn')).toBe('warning');
    });

    it('check resolves to success', () => {
      expect(normalizeCalloutType('check')).toBe('success');
    });

    it('cite resolves to quote', () => {
      expect(normalizeCalloutType('cite')).toBe('quote');
    });

    it('unknown types default to note', () => {
      expect(normalizeCalloutType('unknown')).toBe('note');
      expect(normalizeCalloutType(undefined)).toBe('note');
    });
  });
});
