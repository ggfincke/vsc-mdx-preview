// tests/webview/module-errors.test.ts
// Unit tests for ModuleLoadError and factory functions

import { describe, it, expect } from 'vitest';
import {
  ModuleLoadError,
  createModuleNotFoundError,
  createFetchFailedError,
  createEvaluationFailedError,
  createCircularDependencyError,
} from '../../packages/webview-app/src/module-system/errors';

describe('ModuleLoadError', () => {
  describe('constructor', () => {
    it('should create error with all properties', () => {
      const error = new ModuleLoadError('Test error message', {
        code: 'MODULE_NOT_FOUND',
        moduleId: './component.tsx',
        parentModuleId: '/src/App.tsx',
        suggestions: ['Check the path', 'Install dependencies'],
      });

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ModuleLoadError);
      expect(error.name).toBe('ModuleLoadError');
      expect(error.message).toBe('Test error message');
      expect(error.code).toBe('MODULE_NOT_FOUND');
      expect(error.moduleId).toBe('./component.tsx');
      expect(error.parentModuleId).toBe('/src/App.tsx');
      expect(error.suggestions).toEqual(['Check the path', 'Install dependencies']);
      expect(error.recoverable).toBe(true);
    });

    it('should default suggestions to empty array', () => {
      const error = new ModuleLoadError('Test error', {
        code: 'FETCH_FAILED',
        moduleId: 'test.js',
      });

      expect(error.suggestions).toEqual([]);
    });

    it('should preserve cause error (ES2022)', () => {
      const cause = new Error('Original error');
      const error = new ModuleLoadError('Wrapped error', {
        code: 'EVALUATION_FAILED',
        moduleId: 'test.js',
        cause,
      });

      expect((error as { cause?: Error }).cause).toBe(cause);
    });

    it('should maintain proper prototype chain for instanceof', () => {
      const error = new ModuleLoadError('Test', {
        code: 'MODULE_NOT_FOUND',
        moduleId: 'test.js',
      });

      expect(error instanceof Error).toBe(true);
      expect(error instanceof ModuleLoadError).toBe(true);
    });
  });

  describe('toDisplayMessage()', () => {
    it('should format message without suggestions', () => {
      const error = new ModuleLoadError('Simple error', {
        code: 'MODULE_NOT_FOUND',
        moduleId: 'test.js',
      });

      expect(error.toDisplayMessage()).toBe('Simple error');
    });

    it('should format message with suggestions', () => {
      const error = new ModuleLoadError('Error occurred', {
        code: 'MODULE_NOT_FOUND',
        moduleId: 'test.js',
        suggestions: ['First suggestion', 'Second suggestion'],
      });

      const display = error.toDisplayMessage();

      expect(display).toContain('Error occurred');
      expect(display).toContain('Try:');
      expect(display).toContain('  - First suggestion');
      expect(display).toContain('  - Second suggestion');
    });
  });
});

describe('createModuleNotFoundError', () => {
  it('should create error with MODULE_NOT_FOUND code', () => {
    const error = createModuleNotFoundError('./Button', '/src/App.tsx');

    expect(error.code).toBe('MODULE_NOT_FOUND');
    expect(error.moduleId).toBe('./Button');
    expect(error.parentModuleId).toBe('/src/App.tsx');
  });

  it('should include informative error message', () => {
    const error = createModuleNotFoundError('./utils/helpers', '/src/index.ts');

    expect(error.message).toContain('./utils/helpers');
    expect(error.message).toContain('/src/index.ts');
    expect(error.message).toContain('Cannot find module');
    expect(error.message).toContain('Imported from');
  });

  it('should provide helpful suggestions', () => {
    const error = createModuleNotFoundError('./Component', '/src/App.tsx');

    expect(error.suggestions.length).toBeGreaterThan(0);
    expect(error.suggestions.some((s) => s.includes('import path'))).toBe(true);
    expect(error.suggestions.some((s) => s.includes('file exists'))).toBe(true);
    expect(error.suggestions.some((s) => s.includes('npm packages'))).toBe(true);
    expect(error.suggestions.some((s) => s.includes('.mdx-previewrc.json'))).toBe(
      true
    );
  });
});

describe('createFetchFailedError', () => {
  it('should create error with FETCH_FAILED code', () => {
    const error = createFetchFailedError('./api', '/src/index.ts');

    expect(error.code).toBe('FETCH_FAILED');
    expect(error.moduleId).toBe('./api');
    expect(error.parentModuleId).toBe('/src/index.ts');
  });

  it('should include cause when provided', () => {
    const cause = new Error('Network timeout');
    const error = createFetchFailedError('./api', '/src/index.ts', cause);

    expect((error as { cause?: Error }).cause).toBe(cause);
    // Should also include cause message in suggestions
    expect(error.suggestions.some((s) => s.includes('Network timeout'))).toBe(
      true
    );
  });

  it('should include helpful suggestions', () => {
    const error = createFetchFailedError('./file', '/src/index.ts');

    expect(error.suggestions.length).toBeGreaterThan(0);
    expect(error.suggestions.some((s) => s.includes('file path'))).toBe(true);
    expect(error.suggestions.some((s) => s.includes('permissions'))).toBe(true);
    expect(error.suggestions.some((s) => s.includes('tsconfig.json'))).toBe(true);
  });
});

describe('createEvaluationFailedError', () => {
  it('should create error with EVALUATION_FAILED code', () => {
    const cause = new Error('ReferenceError: foo is not defined');
    const error = createEvaluationFailedError('/src/module.js', cause);

    expect(error.code).toBe('EVALUATION_FAILED');
    expect(error.moduleId).toBe('/src/module.js');
  });

  it('should include cause error message in main message', () => {
    const cause = new Error('Cannot read property x of undefined');
    const error = createEvaluationFailedError('/src/module.js', cause);

    expect(error.message).toContain('Cannot read property x of undefined');
    expect(error.message).toContain('/src/module.js');
  });

  it('should preserve cause error', () => {
    const cause = new Error('Original error');
    const error = createEvaluationFailedError('/src/module.js', cause);

    expect((error as { cause?: Error }).cause).toBe(cause);
  });

  it('should provide helpful suggestions for runtime errors', () => {
    const cause = new Error('TypeError');
    const error = createEvaluationFailedError('/src/module.js', cause);

    expect(error.suggestions.length).toBeGreaterThan(0);
    expect(error.suggestions.some((s) => s.includes('syntax errors'))).toBe(true);
    expect(error.suggestions.some((s) => s.includes('imports'))).toBe(true);
    expect(error.suggestions.some((s) => s.includes('runtime errors'))).toBe(true);
  });
});

describe('createCircularDependencyError', () => {
  it('should create error with CIRCULAR_DEPENDENCY code', () => {
    const chain = ['A.js', 'B.js', 'A.js'];
    const error = createCircularDependencyError('A.js', chain);

    expect(error.code).toBe('CIRCULAR_DEPENDENCY');
    expect(error.moduleId).toBe('A.js');
  });

  it('should include dependency chain in message', () => {
    const chain = ['/src/A.ts', '/src/B.ts', '/src/C.ts', '/src/A.ts'];
    const error = createCircularDependencyError('/src/A.ts', chain);

    expect(error.message).toContain('Circular dependency detected');
    expect(error.message).toContain('/src/A.ts');
    expect(error.message).toContain('/src/B.ts');
    expect(error.message).toContain('/src/C.ts');
    expect(error.message).toContain('->');
  });

  it('should provide helpful suggestions', () => {
    const chain = ['A.js', 'B.js', 'A.js'];
    const error = createCircularDependencyError('A.js', chain);

    expect(error.suggestions.length).toBeGreaterThan(0);
    expect(error.suggestions.some((s) => s.includes('restructur'))).toBe(true);
    expect(error.suggestions.some((s) => s.includes('separate file'))).toBe(true);
    expect(error.suggestions.some((s) => s.includes('lazy') || s.includes('dynamic'))).toBe(
      true
    );
  });
});

describe('error code types', () => {
  it('should only allow valid error codes', () => {
    // TypeScript should enforce this at compile time, but we can test runtime behavior
    const codes = ['MODULE_NOT_FOUND', 'FETCH_FAILED', 'CIRCULAR_DEPENDENCY', 'EVALUATION_FAILED'];

    codes.forEach((code) => {
      const error = new ModuleLoadError('Test', {
        code: code as 'MODULE_NOT_FOUND',
        moduleId: 'test.js',
      });
      expect(error.code).toBe(code);
    });
  });
});

describe('recoverable flag', () => {
  it('should always be true for ModuleLoadError', () => {
    const errors = [
      createModuleNotFoundError('test', 'parent'),
      createFetchFailedError('test', 'parent'),
      createEvaluationFailedError('test', new Error('cause')),
      createCircularDependencyError('test', ['a', 'b', 'a']),
    ];

    errors.forEach((error) => {
      expect(error.recoverable).toBe(true);
    });
  });
});
