// tests/shared/module-error-types.test.ts
// unit tests for shared module error types

import { describe, it, expect } from 'vitest';
import {
  isModuleErrorData,
  formatModuleErrorDisplay,
  getSuggestionsForCode,
  MODULE_ERROR_LABELS,
  type ModuleErrorCode,
} from '../../packages/shared/errors';

describe('isModuleErrorData', () => {
  it('should return true for valid ModuleErrorData', () => {
    const data = {
      code: 'E100',
      message: 'Test error',
      moduleId: './test.ts',
      suggestions: [],
      recoverable: true,
    };
    expect(isModuleErrorData(data)).toBe(true);
  });

  it('should return true for minimal ModuleErrorData', () => {
    const data = {
      code: 'E100',
      message: 'Test error',
      moduleId: './test.ts',
    };
    expect(isModuleErrorData(data)).toBe(true);
  });

  it('should return false for null', () => {
    expect(isModuleErrorData(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isModuleErrorData(undefined)).toBe(false);
  });

  it('should return false for object missing code', () => {
    expect(isModuleErrorData({ message: 'test', moduleId: 'test.js' })).toBe(
      false
    );
  });

  it('should return false for object missing message', () => {
    expect(isModuleErrorData({ code: 'E100', moduleId: 'test.js' })).toBe(false);
  });

  it('should return false for object missing moduleId', () => {
    expect(isModuleErrorData({ code: 'E100', message: 'test' })).toBe(false);
  });

  it('should return false for non-string code', () => {
    expect(
      isModuleErrorData({ code: 100, message: 'test', moduleId: 'test.js' })
    ).toBe(false);
  });
});

describe('formatModuleErrorDisplay', () => {
  it('should format error without suggestions', () => {
    const data = {
      code: 'E100' as ModuleErrorCode,
      message: 'Cannot find module',
      moduleId: './test.ts',
      suggestions: [],
      recoverable: true,
    };

    const display = formatModuleErrorDisplay(data);
    expect(display).toBe('Cannot find module');
  });

  it('should format error w/ suggestions', () => {
    const data = {
      code: 'E100' as ModuleErrorCode,
      message: 'Cannot find module',
      moduleId: './test.ts',
      suggestions: ['Check path', 'Install deps'],
      recoverable: true,
    };

    const display = formatModuleErrorDisplay(data);
    expect(display).toContain('Cannot find module');
    expect(display).toContain('Try:');
    expect(display).toContain('  - Check path');
    expect(display).toContain('  - Install deps');
  });

  it('should handle empty suggestions array', () => {
    const data = {
      code: 'E100' as ModuleErrorCode,
      message: 'Error message',
      moduleId: './test.ts',
      suggestions: [],
      recoverable: true,
    };

    const display = formatModuleErrorDisplay(data);
    expect(display).toBe('Error message');
    expect(display).not.toContain('Try:');
  });
});

describe('getSuggestionsForCode', () => {
  it('should return suggestions for E100 (MODULE_NOT_FOUND)', () => {
    const suggestions = getSuggestionsForCode('E100');
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some((s) => s.includes('import path'))).toBe(true);
  });

  it('should return suggestions for E101 (OUTSIDE_WORKSPACE)', () => {
    const suggestions = getSuggestionsForCode('E101');
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some((s) => s.includes('workspace'))).toBe(true);
  });

  it('should return suggestions for E102 (CIRCULAR_DEPENDENCY)', () => {
    const suggestions = getSuggestionsForCode('E102');
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some((s) => s.includes('circular'))).toBe(true);
  });

  it('should return suggestions for E110 (PARSE_ERROR)', () => {
    const suggestions = getSuggestionsForCode('E110');
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some((s) => s.includes('syntax'))).toBe(true);
  });

  it('should return suggestions for E120 (TRANSFORM_ERROR)', () => {
    const suggestions = getSuggestionsForCode('E120');
    expect(suggestions.length).toBeGreaterThan(0);
  });

  it('should return suggestions for E140 (FETCH_FAILED)', () => {
    const suggestions = getSuggestionsForCode('E140');
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some((s) => s.includes('file path'))).toBe(true);
  });

  it('should return suggestions for E150 (EVALUATION_FAILED)', () => {
    const suggestions = getSuggestionsForCode('E150');
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some((s) => s.includes('runtime'))).toBe(true);
  });
});

describe('MODULE_ERROR_LABELS', () => {
  it('should have human-readable labels for all codes', () => {
    const codes: ModuleErrorCode[] = [
      'E100',
      'E101',
      'E102',
      'E110',
      'E120',
      'E140',
      'E150',
    ];

    codes.forEach((code) => {
      expect(MODULE_ERROR_LABELS[code]).toBeDefined();
      expect(typeof MODULE_ERROR_LABELS[code]).toBe('string');
      expect(MODULE_ERROR_LABELS[code].length).toBeGreaterThan(0);
    });
  });

  it('should have descriptive labels', () => {
    expect(MODULE_ERROR_LABELS['E100']).toBe('Module Not Found');
    expect(MODULE_ERROR_LABELS['E102']).toBe('Circular Dependency');
    expect(MODULE_ERROR_LABELS['E150']).toBe('Evaluation Failed');
  });
});
