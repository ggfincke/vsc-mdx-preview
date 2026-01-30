// tests/webview/module-errors.test.ts
// unit tests for ModuleLoadError & factory functions

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
        code: 'E100',
        moduleId: './component.tsx',
        parentModuleId: '/src/App.tsx',
        suggestions: ['Check the path', 'Install dependencies'],
      });

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ModuleLoadError);
      expect(error.name).toBe('ModuleLoadError');
      expect(error.message).toBe('Test error message');
      expect(error.code).toBe('E100');
      expect(error.moduleId).toBe('./component.tsx');
      expect(error.parentModuleId).toBe('/src/App.tsx');
      expect(error.suggestions).toEqual(['Check the path', 'Install dependencies']);
      expect(error.recoverable).toBe(true);
    });

    it('should use default suggestions from shared module when not provided', () => {
      const error = new ModuleLoadError('Test error', {
        code: 'E100',
        moduleId: 'test.js',
      });

      // should get suggestions from getSuggestionsForCode('E100')
      expect(error.suggestions.length).toBeGreaterThan(0);
      expect(error.suggestions.some((s) => s.includes('import path'))).toBe(true);
    });

    it('should preserve cause error (ES2022)', () => {
      const cause = new Error('Original error');
      const error = new ModuleLoadError('Wrapped error', {
        code: 'E150',
        moduleId: 'test.js',
        cause,
      });

      expect((error as { cause?: Error }).cause).toBe(cause);
    });

    it('should maintain proper prototype chain for instanceof', () => {
      const error = new ModuleLoadError('Test', {
        code: 'E100',
        moduleId: 'test.js',
      });

      expect(error instanceof Error).toBe(true);
      expect(error instanceof ModuleLoadError).toBe(true);
    });
  });

  describe('toDisplayMessage()', () => {
    it('should format message without suggestions', () => {
      const error = new ModuleLoadError('Simple error', {
        code: 'E100',
        moduleId: 'test.js',
        suggestions: [],
      });

      expect(error.toDisplayMessage()).toBe('Simple error');
    });

    it('should format message with suggestions', () => {
      const error = new ModuleLoadError('Error occurred', {
        code: 'E100',
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

  describe('toModuleErrorData()', () => {
    it('should serialize to ModuleErrorData', () => {
      const cause = new Error('Original error');
      const error = new ModuleLoadError('Test error', {
        code: 'E100',
        moduleId: './test.ts',
        parentModuleId: '/src/index.ts',
        suggestions: ['Check path'],
        cause,
      });

      const data = error.toModuleErrorData();

      expect(data.code).toBe('E100');
      expect(data.message).toBe('Test error');
      expect(data.moduleId).toBe('./test.ts');
      expect(data.parentModuleId).toBe('/src/index.ts');
      expect(data.suggestions).toEqual(['Check path']);
      expect(data.recoverable).toBe(true);
      expect(data.causeMessage).toBe('Original error');
      expect(data.stack).toBeDefined();
    });
  });
});

describe('createModuleNotFoundError', () => {
  it('should create error with E100 code', () => {
    const error = createModuleNotFoundError('./Button', '/src/App.tsx');

    expect(error.code).toBe('E100');
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

  it('should provide helpful suggestions from shared module', () => {
    const error = createModuleNotFoundError('./Component', '/src/App.tsx');

    expect(error.suggestions.length).toBeGreaterThan(0);
    expect(error.suggestions.some((s) => s.includes('import path'))).toBe(true);
    expect(error.suggestions.some((s) => s.includes('file exists'))).toBe(true);
    expect(error.suggestions.some((s) => s.includes('npm packages'))).toBe(true);
    expect(error.suggestions.some((s) => s.includes('.mdx-previewrc.json'))).toBe(
      true
    );
  });

  it('should serialize to ModuleErrorData', () => {
    const error = createModuleNotFoundError('./Button', '/src/App.tsx');
    const data = error.toModuleErrorData();

    expect(data.code).toBe('E100');
    expect(data.moduleId).toBe('./Button');
    expect(data.parentModuleId).toBe('/src/App.tsx');
    expect(data.suggestions.length).toBeGreaterThan(0);
    expect(data.recoverable).toBe(true);
  });
});

describe('createFetchFailedError', () => {
  it('should create error with E140 code', () => {
    const error = createFetchFailedError('./api', '/src/index.ts');

    expect(error.code).toBe('E140');
    expect(error.moduleId).toBe('./api');
    expect(error.parentModuleId).toBe('/src/index.ts');
  });

  it('should include cause when provided', () => {
    const cause = new Error('Network timeout');
    const error = createFetchFailedError('./api', '/src/index.ts', cause);

    expect((error as { cause?: Error }).cause).toBe(cause);
    // should include cause message in suggestions
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
  it('should create error with E150 code', () => {
    const cause = new Error('ReferenceError: foo is not defined');
    const error = createEvaluationFailedError('/src/module.js', cause);

    expect(error.code).toBe('E150');
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
  it('should create error with E102 code', () => {
    const chain = ['A.js', 'B.js', 'A.js'];
    const error = createCircularDependencyError('A.js', chain);

    expect(error.code).toBe('E102');
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
    expect(
      error.suggestions.some((s) => s.includes('lazy') || s.includes('dynamic'))
    ).toBe(true);
  });
});

describe('error code types', () => {
  it('should only allow valid E1xx error codes', () => {
    const codes = ['E100', 'E102', 'E140', 'E150'];

    codes.forEach((code) => {
      const error = new ModuleLoadError('Test', {
        code: code as 'E100',
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
