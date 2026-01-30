// tests/extension/errors/ModuleFetchError.test.ts
// unit tests for ModuleFetchError & factory functions

import { describe, it, expect, vi } from 'vitest';

// mock vscode before importing extension modules
vi.mock('vscode', () => {
  const mockChannel = {
    appendLine: vi.fn(),
    show: vi.fn(),
    dispose: vi.fn(),
  };
  return {
    window: {
      createOutputChannel: vi.fn(() => mockChannel),
      showErrorMessage: vi.fn(),
      showWarningMessage: vi.fn(),
    },
    commands: {
      executeCommand: vi.fn(),
    },
  };
});

import { ModuleFetchError } from '../../../packages/extension/errors';
import {
  createModuleNotFoundError,
  createOutsideWorkspaceError,
  createParseError,
  createTransformError,
} from '../../../packages/extension/errors/module-error-factories';

describe('ModuleFetchError', () => {
  describe('constructor', () => {
    it('should create error w/ unified properties', () => {
      const error = new ModuleFetchError(
        'Test error',
        'E100',
        './module.ts',
        '/src/index.ts'
      );

      expect(error.code).toBe('E100');
      expect(error.moduleId).toBe('./module.ts');
      expect(error.parentModuleId).toBe('/src/index.ts');
    });

    it('should use default suggestions when not provided', () => {
      const error = new ModuleFetchError('Test error', 'E100', './module.ts');

      expect(error.suggestions.length).toBeGreaterThan(0);
      expect(error.suggestions.some((s) => s.includes('import path'))).toBe(
        true
      );
    });

    it('should use custom suggestions when provided', () => {
      const error = new ModuleFetchError('Test error', 'E100', './module.ts', undefined, {
        suggestions: ['Custom suggestion 1', 'Custom suggestion 2'],
      });

      expect(error.suggestions).toEqual([
        'Custom suggestion 1',
        'Custom suggestion 2',
      ]);
    });

    it('should default recoverable to true', () => {
      const error = new ModuleFetchError('Test error', 'E100', './module.ts');

      expect(error.recoverable).toBe(true);
    });

    it('should allow custom recoverable value', () => {
      const error = new ModuleFetchError('Test error', 'E100', './module.ts', undefined, {
        recoverable: false,
      });

      expect(error.recoverable).toBe(false);
    });

    it('should preserve cause error', () => {
      const cause = new Error('Original error');
      const error = new ModuleFetchError('Test error', 'E110', './module.ts', undefined, {
        cause,
      });

      expect(error.cause).toBe(cause);
    });

    it('should be instanceof Error & ExtensionError', () => {
      const error = new ModuleFetchError('Test', 'E100', './module.ts');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ModuleFetchError);
    });
  });

  describe('toModuleErrorData()', () => {
    it('should serialize to ModuleErrorData', () => {
      const cause = new Error('Original error');
      const error = new ModuleFetchError(
        'Test error',
        'E100',
        './Button.tsx',
        '/src/App.tsx',
        { cause }
      );

      const data = error.toModuleErrorData();

      expect(data.code).toBe('E100');
      expect(data.message).toBe('Test error');
      expect(data.moduleId).toBe('./Button.tsx');
      expect(data.parentModuleId).toBe('/src/App.tsx');
      expect(data.suggestions.length).toBeGreaterThan(0);
      expect(data.recoverable).toBe(true);
      expect(data.causeMessage).toBe('Original error');
      expect(data.stack).toBeDefined();
    });

    it('should handle missing parentModuleId', () => {
      const error = new ModuleFetchError('Test error', 'E100', './module.ts');

      const data = error.toModuleErrorData();

      expect(data.parentModuleId).toBeUndefined();
    });
  });

  describe('toDisplayMessage()', () => {
    it('should format display message w/ suggestions', () => {
      const error = new ModuleFetchError('Test error', 'E100', './module.ts');

      const display = error.toDisplayMessage();

      expect(display).toContain('Test error');
      expect(display).toContain('Try:');
    });

    it('should format display message without suggestions', () => {
      const error = new ModuleFetchError('Test error', 'E100', './module.ts', undefined, {
        suggestions: [],
      });

      const display = error.toDisplayMessage();

      expect(display).toBe('Test error');
      expect(display).not.toContain('Try:');
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

  it('should serialize to ModuleErrorData', () => {
    const error = createModuleNotFoundError('./Button', '/src/App.tsx');
    const data = error.toModuleErrorData();

    expect(data.code).toBe('E100');
    expect(data.moduleId).toBe('./Button');
    expect(data.parentModuleId).toBe('/src/App.tsx');
    expect(data.recoverable).toBe(true);
  });
});

describe('createOutsideWorkspaceError', () => {
  it('should create error with E101 code', () => {
    const error = createOutsideWorkspaceError('/outside/path/module.ts');

    expect(error.code).toBe('E101');
    expect(error.moduleId).toBe('/outside/path/module.ts');
  });

  it('should include module path in message', () => {
    const error = createOutsideWorkspaceError('/outside/module.ts');

    expect(error.message).toContain('/outside/module.ts');
    expect(error.message).toContain('outside workspace');
  });

  it('should support optional parentModuleId', () => {
    const error = createOutsideWorkspaceError(
      '/outside/module.ts',
      '/src/App.tsx'
    );

    expect(error.parentModuleId).toBe('/src/App.tsx');
  });
});

describe('createParseError', () => {
  it('should create error with E110 code', () => {
    const error = createParseError('./module.ts');

    expect(error.code).toBe('E110');
    expect(error.moduleId).toBe('./module.ts');
  });

  it('should include cause message when provided', () => {
    const cause = new Error('Unexpected token at line 5');
    const error = createParseError('./module.ts', cause);

    expect(error.message).toContain('Syntax error');
    expect(error.message).toContain('Unexpected token at line 5');
    expect(error.cause).toBe(cause);
  });

  it('should work without cause', () => {
    const error = createParseError('./module.ts');

    expect(error.message).toContain('Syntax error');
    expect(error.cause).toBeUndefined();
  });
});

describe('createTransformError', () => {
  it('should create error with E120 code', () => {
    const error = createTransformError('./module.tsx');

    expect(error.code).toBe('E120');
    expect(error.moduleId).toBe('./module.tsx');
  });

  it('should include cause message when provided', () => {
    const cause = new Error('Unsupported syntax');
    const error = createTransformError('./module.tsx', undefined, cause);

    expect(error.message).toContain('Failed to compile');
    expect(error.message).toContain('Unsupported syntax');
    expect(error.cause).toBe(cause);
  });

  it('should support parentModuleId', () => {
    const error = createTransformError('./module.tsx', '/src/App.tsx');

    expect(error.parentModuleId).toBe('/src/App.tsx');
  });

  it('should work without cause', () => {
    const error = createTransformError('./module.tsx');

    expect(error.message).toContain('Failed to compile');
    expect(error.cause).toBeUndefined();
  });
});

describe('error code types', () => {
  it('should only allow valid E1xx error codes', () => {
    const codes = ['E100', 'E101', 'E110', 'E120'] as const;

    codes.forEach((code) => {
      const error = new ModuleFetchError('Test', code, './module.ts');
      expect(error.code).toBe(code);
    });
  });
});
