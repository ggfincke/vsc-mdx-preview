// packages/extension/test/validation.test.ts
// unit tests for validation utilities (string, number, URL validation)

import { describe, it, expect, vi } from 'vitest';
import {
  validateString,
  validateBoolean,
  validateNumber,
  validateUrl,
  validateOptionalNumber,
} from '../utils/validation';

describe('validation', () => {
  describe('validateString', () => {
    it('returns string for valid string input', () => {
      expect(validateString('hello', 'test')).toBe('hello');
    });

    it('returns undefined for non-string input', () => {
      const log = vi.fn();
      expect(validateString(123, 'test', { log })).toBeUndefined();
      expect(log).toHaveBeenCalledWith('test must be a string', 123);
    });

    it('returns undefined for empty string by default', () => {
      const log = vi.fn();
      expect(validateString('', 'test', { log })).toBeUndefined();
      expect(log).toHaveBeenCalledWith('test cannot be empty', '');
    });

    it('returns undefined for whitespace-only string', () => {
      const log = vi.fn();
      expect(validateString('   ', 'test', { log })).toBeUndefined();
      expect(log).toHaveBeenCalledWith('test cannot be empty', '   ');
    });

    it('allows empty string when allowEmpty is true', () => {
      expect(validateString('', 'test', { allowEmpty: true })).toBe('');
    });

    it('includes context prefix in error messages', () => {
      const log = vi.fn();
      validateString(123, 'test', { log, context: 'fetch' });
      expect(log).toHaveBeenCalledWith('fetch: test must be a string', 123);
    });

    it('returns undefined for null', () => {
      const log = vi.fn();
      expect(validateString(null, 'test', { log })).toBeUndefined();
    });

    it('returns undefined for undefined', () => {
      const log = vi.fn();
      expect(validateString(undefined, 'test', { log })).toBeUndefined();
    });
  });

  describe('validateBoolean', () => {
    it('returns true for boolean true', () => {
      expect(validateBoolean(true, 'test')).toBe(true);
    });

    it('returns false for boolean false', () => {
      expect(validateBoolean(false, 'test')).toBe(false);
    });

    it('returns undefined for non-boolean input', () => {
      const log = vi.fn();
      expect(validateBoolean('true', 'test', { log })).toBeUndefined();
      expect(log).toHaveBeenCalledWith('test must be a boolean');
    });

    it('returns undefined for number', () => {
      const log = vi.fn();
      expect(validateBoolean(1, 'test', { log })).toBeUndefined();
    });

    it('includes context in error message', () => {
      const log = vi.fn();
      validateBoolean('yes', 'flag', { log, context: 'config' });
      expect(log).toHaveBeenCalledWith('config: flag must be a boolean');
    });
  });

  describe('validateNumber', () => {
    it('returns number for valid number input', () => {
      expect(validateNumber(42, 'test')).toBe(42);
    });

    it('returns 0 for zero', () => {
      expect(validateNumber(0, 'test')).toBe(0);
    });

    it('returns negative numbers', () => {
      expect(validateNumber(-5, 'test')).toBe(-5);
    });

    it('returns undefined for non-number input', () => {
      const log = vi.fn();
      expect(validateNumber('42', 'test', { log })).toBeUndefined();
      expect(log).toHaveBeenCalledWith('test must be a number', '42');
    });

    it('returns undefined for NaN by default', () => {
      const log = vi.fn();
      expect(validateNumber(NaN, 'test', { log })).toBeUndefined();
      expect(log).toHaveBeenCalledWith('test must be finite', NaN);
    });

    it('returns undefined for Infinity by default', () => {
      const log = vi.fn();
      expect(validateNumber(Infinity, 'test', { log })).toBeUndefined();
    });

    it('allows Infinity when finite is false', () => {
      expect(validateNumber(Infinity, 'test', { finite: false })).toBe(Infinity);
    });

    it('validates minimum constraint', () => {
      const log = vi.fn();
      expect(validateNumber(5, 'test', { min: 10, log })).toBeUndefined();
      expect(log).toHaveBeenCalledWith('test must be >= 10', 5);
    });

    it('validates maximum constraint', () => {
      const log = vi.fn();
      expect(validateNumber(100, 'test', { max: 50, log })).toBeUndefined();
      expect(log).toHaveBeenCalledWith('test must be <= 50', 100);
    });

    it('returns value when within min/max range', () => {
      expect(validateNumber(25, 'test', { min: 10, max: 50 })).toBe(25);
    });

    it('returns value at min boundary', () => {
      expect(validateNumber(10, 'test', { min: 10 })).toBe(10);
    });

    it('returns value at max boundary', () => {
      expect(validateNumber(50, 'test', { max: 50 })).toBe(50);
    });
  });

  describe('validateUrl', () => {
    it('returns URL for valid URL string', () => {
      const result = validateUrl('https://example.com/path', 'url');
      expect(result).toBeInstanceOf(URL);
      expect(result?.href).toBe('https://example.com/path');
    });

    it('returns undefined for non-string input', () => {
      const log = vi.fn();
      expect(validateUrl(123, 'url', { log })).toBeUndefined();
    });

    it('returns undefined for invalid URL', () => {
      const log = vi.fn();
      expect(validateUrl('not-a-url', 'url', { log })).toBeUndefined();
      expect(log).toHaveBeenCalledWith('failed to parse url', 'not-a-url');
    });

    it('validates allowed schemes', () => {
      const log = vi.fn();
      expect(
        validateUrl('ftp://example.com', 'url', {
          allowedSchemes: ['https:', 'http:'],
          log,
        })
      ).toBeUndefined();
      expect(log).toHaveBeenCalledWith('disallowed scheme for url', 'ftp:');
    });

    it('allows URL with valid scheme', () => {
      const result = validateUrl('https://example.com', 'url', {
        allowedSchemes: ['https:'],
      });
      expect(result).toBeInstanceOf(URL);
    });

    it('returns undefined for empty string', () => {
      const log = vi.fn();
      expect(validateUrl('', 'url', { log })).toBeUndefined();
    });
  });

  describe('validateOptionalNumber', () => {
    it('returns undefined for undefined input', () => {
      expect(validateOptionalNumber(undefined, 'line')).toBeUndefined();
    });

    it('returns number for valid number input', () => {
      expect(validateOptionalNumber(42, 'line')).toBe(42);
    });

    it('validates min constraint', () => {
      const log = vi.fn();
      expect(validateOptionalNumber(0, 'line', { min: 1, log })).toBeUndefined();
    });

    it('returns undefined for non-number input', () => {
      const log = vi.fn();
      expect(validateOptionalNumber('42', 'line', { log })).toBeUndefined();
    });
  });
});
