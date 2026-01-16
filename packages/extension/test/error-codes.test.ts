// packages/extension/test/error-codes.test.ts
// unit tests for error codes enum

import { describe, it, expect } from 'vitest';
import { ErrorCode } from '../errors/error-codes';

describe('ErrorCode enum', () => {
  describe('module fetch error codes', () => {
    it('contains MODULE_NOT_FOUND', () => {
      expect(ErrorCode.MODULE_NOT_FOUND).toBe('MODULE_NOT_FOUND');
    });

    it('contains OUTSIDE_WORKSPACE', () => {
      expect(ErrorCode.OUTSIDE_WORKSPACE).toBe('OUTSIDE_WORKSPACE');
    });

    it('contains PARSE_ERROR', () => {
      expect(ErrorCode.PARSE_ERROR).toBe('PARSE_ERROR');
    });

    it('contains TRANSFORM_ERROR', () => {
      expect(ErrorCode.TRANSFORM_ERROR).toBe('TRANSFORM_ERROR');
    });
  });

  describe('transpile error codes', () => {
    it('contains TRANSPILE_ERROR', () => {
      expect(ErrorCode.TRANSPILE_ERROR).toBe('TRANSPILE_ERROR');
    });
  });

  describe('security error codes', () => {
    it('contains PATH_TRAVERSAL', () => {
      expect(ErrorCode.PATH_TRAVERSAL).toBe('PATH_TRAVERSAL');
    });

    it('contains TRUST_VIOLATION', () => {
      expect(ErrorCode.TRUST_VIOLATION).toBe('TRUST_VIOLATION');
    });
  });

  describe('config error codes', () => {
    it('contains CONFIG_PARSE_ERROR', () => {
      expect(ErrorCode.CONFIG_PARSE_ERROR).toBe('CONFIG_PARSE_ERROR');
    });

    it('contains CONFIG_VALIDATION_ERROR', () => {
      expect(ErrorCode.CONFIG_VALIDATION_ERROR).toBe('CONFIG_VALIDATION_ERROR');
    });
  });

  describe('plugin error codes', () => {
    it('contains PLUGIN_NOT_FOUND', () => {
      expect(ErrorCode.PLUGIN_NOT_FOUND).toBe('PLUGIN_NOT_FOUND');
    });

    it('contains PLUGIN_LOAD_ERROR', () => {
      expect(ErrorCode.PLUGIN_LOAD_ERROR).toBe('PLUGIN_LOAD_ERROR');
    });

    it('contains PLUGIN_INVALID_EXPORT', () => {
      expect(ErrorCode.PLUGIN_INVALID_EXPORT).toBe('PLUGIN_INVALID_EXPORT');
    });
  });

  describe('tailwind error codes', () => {
    it('contains TAILWIND_COMPILATION_ERROR', () => {
      expect(ErrorCode.TAILWIND_COMPILATION_ERROR).toBe(
        'TAILWIND_COMPILATION_ERROR'
      );
    });
  });

  describe('general error codes', () => {
    it('contains UNKNOWN_ERROR', () => {
      expect(ErrorCode.UNKNOWN_ERROR).toBe('UNKNOWN_ERROR');
    });
  });

  describe('code uniqueness', () => {
    it('all error codes are unique', () => {
      const codes = Object.values(ErrorCode);
      const uniqueCodes = new Set(codes);
      expect(codes.length).toBe(uniqueCodes.size);
    });
  });
});
