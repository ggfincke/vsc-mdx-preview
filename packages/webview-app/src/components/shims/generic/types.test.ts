// packages/webview-app/src/components/shims/generic/types.test.ts
// Tests for generic component type utilities

import { describe, it, expect } from 'vitest';
import {
  normalizeCalloutType,
  CALLOUT_TITLES,
  type CalloutType,
} from './types';

describe('normalizeCalloutType', () => {
  describe('valid types', () => {
    it.each<CalloutType>([
      'note',
      'tip',
      'warning',
      'danger',
      'info',
      'caution',
      'important',
    ])('returns "%s" unchanged', (type) => {
      expect(normalizeCalloutType(type)).toBe(type);
    });
  });

  describe('case insensitivity', () => {
    it('handles uppercase', () => {
      expect(normalizeCalloutType('NOTE')).toBe('note');
      expect(normalizeCalloutType('WARNING')).toBe('warning');
    });

    it('handles mixed case', () => {
      expect(normalizeCalloutType('Note')).toBe('note');
      expect(normalizeCalloutType('TiP')).toBe('tip');
      expect(normalizeCalloutType('DanGer')).toBe('danger');
    });
  });

  describe('aliases', () => {
    it('maps "success" to "tip"', () => {
      expect(normalizeCalloutType('success')).toBe('tip');
      expect(normalizeCalloutType('SUCCESS')).toBe('tip');
    });

    it('maps "error" to "danger"', () => {
      expect(normalizeCalloutType('error')).toBe('danger');
      expect(normalizeCalloutType('ERROR')).toBe('danger');
    });

    it('maps "warn" to "warning"', () => {
      expect(normalizeCalloutType('warn')).toBe('warning');
      expect(normalizeCalloutType('WARN')).toBe('warning');
    });

    it('maps "hint" to "tip"', () => {
      expect(normalizeCalloutType('hint')).toBe('tip');
      expect(normalizeCalloutType('HINT')).toBe('tip');
    });
  });

  describe('defaults', () => {
    it('returns "note" for undefined', () => {
      expect(normalizeCalloutType(undefined)).toBe('note');
    });

    it('returns "note" for empty string', () => {
      expect(normalizeCalloutType('')).toBe('note');
    });

    it('returns "note" for unknown types', () => {
      expect(normalizeCalloutType('unknown')).toBe('note');
      expect(normalizeCalloutType('foo')).toBe('note');
      expect(normalizeCalloutType('bar')).toBe('note');
      expect(normalizeCalloutType('custom')).toBe('note');
    });
  });
});

describe('CALLOUT_TITLES', () => {
  const expectedTitles: Record<CalloutType, string> = {
    note: 'Note',
    tip: 'Tip',
    warning: 'Warning',
    danger: 'Danger',
    info: 'Info',
    caution: 'Caution',
    important: 'Important',
  };

  it.each(Object.entries(expectedTitles) as [CalloutType, string][])(
    'has title "%s" for type "%s"',
    (type, expectedTitle) => {
      expect(CALLOUT_TITLES[type]).toBe(expectedTitle);
    }
  );

  it('has exactly 7 entries', () => {
    expect(Object.keys(CALLOUT_TITLES)).toHaveLength(7);
  });
});
