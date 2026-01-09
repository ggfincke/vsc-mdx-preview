// packages/extension/test/error-messages.test.ts
// tests for error formatting utilities

import { describe, it, expect } from 'vitest';
import {
  ExtensionError,
  ModuleFetchError,
  TranspileError,
  SecurityError,
  PathAccessDeniedError,
} from '../errors';
import { formatUserError, formatLogError } from '../errors/messages';

describe('formatUserError', () => {
  it('replaces {modulePath} placeholder for MODULE_NOT_FOUND', () => {
    const error = new ModuleFetchError(
      'Cannot resolve',
      'MODULE_NOT_FOUND',
      'lodash',
      '/src/index.ts'
    );
    const result = formatUserError(error);
    expect(result).toBe(
      "Cannot find module 'lodash'. Did you run npm install?"
    );
  });

  it('replaces {modulePath} placeholder for PARSE_ERROR', () => {
    const error = new ModuleFetchError(
      'Parse failed',
      'PARSE_ERROR',
      '/src/broken.js'
    );
    const result = formatUserError(error);
    expect(result).toBe("Syntax error in '/src/broken.js'");
  });

  it('replaces {modulePath} placeholder for TRANSFORM_ERROR', () => {
    const error = new ModuleFetchError(
      'Transform failed',
      'TRANSFORM_ERROR',
      '/src/App.tsx'
    );
    const result = formatUserError(error);
    expect(result).toBe("Failed to compile '/src/App.tsx'");
  });

  it('replaces {sourceFile} and {line} for TRANSPILE_ERROR', () => {
    const error = new TranspileError('Syntax error', '/src/App.tsx', 42, 10);
    const result = formatUserError(error);
    expect(result).toBe("Compilation error in '/src/App.tsx' at line 42");
  });

  it('replaces {attemptedPath} for PATH_TRAVERSAL', () => {
    const error = new SecurityError(
      'Access denied',
      'PATH_TRAVERSAL',
      '/etc/passwd'
    );
    const result = formatUserError(error);
    expect(result).toBe("Access denied: '/etc/passwd' is outside workspace");
  });

  it('keeps placeholder if field is undefined', () => {
    const error = new ModuleFetchError('Error', 'PARSE_ERROR');
    const result = formatUserError(error);
    // modulePath is undefined, placeholder should remain
    expect(result).toBe("Syntax error in '{modulePath}'");
  });

  it('falls back to error.message for unknown codes', () => {
    const error = new ExtensionError('Custom message', 'UNKNOWN_CODE');
    const result = formatUserError(error);
    expect(result).toBe('Custom message');
  });

  it('handles PathAccessDeniedError', () => {
    const error = new PathAccessDeniedError('/outside/path');
    const result = formatUserError(error);
    expect(result).toBe("Access denied: '/outside/path' is outside workspace");
  });

  it('uses TRUST_VIOLATION message', () => {
    const error = new SecurityError('Blocked', 'TRUST_VIOLATION');
    const result = formatUserError(error);
    expect(result).toBe(
      'Operation blocked - workspace not trusted or scripts disabled'
    );
  });

  it('replaces {modulePath} for OUTSIDE_WORKSPACE', () => {
    const error = new ModuleFetchError(
      'Outside',
      'OUTSIDE_WORKSPACE',
      '/external/file.js'
    );
    const result = formatUserError(error);
    expect(result).toBe(
      "Cannot access '/external/file.js' - outside workspace folders"
    );
  });
});

describe('formatLogError', () => {
  it('includes code and message', () => {
    const error = new ModuleFetchError('Test', 'MODULE_NOT_FOUND', 'foo');
    const result = formatLogError(error);
    expect(result.code).toBe('MODULE_NOT_FOUND');
    expect(result.message).toBe('Test');
  });

  it('includes custom fields (modulePath, parentModule)', () => {
    const error = new ModuleFetchError(
      'Test',
      'MODULE_NOT_FOUND',
      'lodash',
      '/src/index.ts'
    );
    const result = formatLogError(error);
    expect(result.modulePath).toBe('lodash');
    expect(result.parentModule).toBe('/src/index.ts');
  });

  it('includes TranspileError source location', () => {
    const error = new TranspileError('Error', '/src/App.tsx', 10, 5);
    const result = formatLogError(error);
    expect(result.sourceFile).toBe('/src/App.tsx');
    expect(result.line).toBe(10);
    expect(result.column).toBe(5);
  });

  it('includes SecurityError attemptedPath', () => {
    const error = new SecurityError('Denied', 'PATH_TRAVERSAL', '/etc/passwd');
    const result = formatLogError(error);
    expect(result.attemptedPath).toBe('/etc/passwd');
  });

  it('includes PathAccessDeniedError fsPath', () => {
    const error = new PathAccessDeniedError('/outside/path');
    const result = formatLogError(error);
    expect(result.fsPath).toBe('/outside/path');
    expect(result.attemptedPath).toBe('/outside/path');
  });

  it('includes cause message when present', () => {
    const cause = new Error('Original error');
    const error = new ModuleFetchError(
      'Wrapped',
      'PARSE_ERROR',
      'foo',
      undefined,
      cause
    );
    const result = formatLogError(error);
    expect(result.cause).toBe('Original error');
  });

  it('does not include cause when not present', () => {
    const error = new ModuleFetchError('Test', 'MODULE_NOT_FOUND');
    const result = formatLogError(error);
    expect(result).not.toHaveProperty('cause');
  });

  it('does not include stack in result', () => {
    const error = new ModuleFetchError('Test', 'MODULE_NOT_FOUND');
    const result = formatLogError(error);
    expect(result).not.toHaveProperty('stack');
  });

  it('does not include name in result', () => {
    const error = new ModuleFetchError('Test', 'MODULE_NOT_FOUND');
    const result = formatLogError(error);
    expect(result).not.toHaveProperty('name');
  });

  it('handles errors with no custom fields', () => {
    const error = new ExtensionError('Simple error', 'UNKNOWN');
    const result = formatLogError(error);
    expect(result).toEqual({
      code: 'UNKNOWN',
      message: 'Simple error',
    });
  });
});
