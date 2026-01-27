// tests/webview/evaluateModule.test.ts
// Unit tests for evaluateModule error handling with stack preservation

import { describe, it, expect, vi } from 'vitest';
import { evaluateModule } from '../../packages/webview-app/src/module-system/eval/evaluateModule';
import type { ModuleRuntime } from '../../packages/webview-app/src/module-system/types';

// Create a minimal mock runtime for testing
function createMockRuntime(): ModuleRuntime {
  return {
    Fragment: 'Fragment',
    jsx: vi.fn(),
    jsxs: vi.fn(),
    require: vi.fn(),
  };
}

describe('evaluateModule', () => {
  describe('successful evaluation', () => {
    it('should evaluate simple CJS module and return exports', () => {
      const code = 'module.exports = { foo: "bar" };';
      const runtime = createMockRuntime();

      const result = evaluateModule(code, 'test-module.js', runtime);

      expect(result).toEqual({ foo: 'bar' });
    });

    it('should evaluate MDX function-body style and return result', () => {
      const code = 'return { default: "component" };';
      const runtime = createMockRuntime();

      const result = evaluateModule(code, 'test.mdx', runtime);

      expect(result).toEqual({ default: 'component' });
    });

    it('should make require available from runtime', () => {
      const mockRequire = vi.fn().mockReturnValue({ imported: true });
      const runtime = createMockRuntime();
      runtime.require = mockRequire;

      const code = 'const dep = require("./dep"); module.exports = dep;';
      const result = evaluateModule(code, 'test.js', runtime);

      expect(mockRequire).toHaveBeenCalledWith('./dep');
      expect(result).toEqual({ imported: true });
    });
  });

  describe('error handling with stack preservation', () => {
    it('should preserve original error as cause (ES2022)', () => {
      const code = 'throw new Error("original error message");';
      const runtime = createMockRuntime();

      expect(() => evaluateModule(code, 'error-test.js', runtime)).toThrow();

      try {
        evaluateModule(code, 'error-test.js', runtime);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        const err = error as Error & { cause?: Error };

        // Check contextual message
        expect(err.message).toContain('Error evaluating module "error-test.js"');
        expect(err.message).toContain('original error message');

        // Check cause is preserved (ES2022)
        expect(err.cause).toBeDefined();
        expect(err.cause).toBeInstanceOf(Error);
        expect(err.cause?.message).toBe('original error message');
      }
    });

    it('should include original stack in error stack with "caused by:" prefix', () => {
      const code = 'throw new Error("stack test error");';
      const runtime = createMockRuntime();

      try {
        evaluateModule(code, 'stack-test.js', runtime);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        const err = error as Error;

        // Stack should include "caused by:" with original stack
        expect(err.stack).toContain('caused by:');
        expect(err.stack).toContain('stack test error');
      }
    });

    it('should handle string errors (not Error instances)', () => {
      const code = 'throw "string error";';
      const runtime = createMockRuntime();

      try {
        evaluateModule(code, 'string-error.js', runtime);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        const err = error as Error & { cause?: Error };

        // Should wrap string error in Error object
        expect(err.message).toContain('Error evaluating module "string-error.js"');
        expect(err.message).toContain('string error');

        // Cause should be normalized to Error
        expect(err.cause).toBeInstanceOf(Error);
        expect(err.cause?.message).toBe('string error');
      }
    });

    it('should handle errors thrown as objects', () => {
      const code = 'throw { custom: "error object" };';
      const runtime = createMockRuntime();

      try {
        evaluateModule(code, 'object-error.js', runtime);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        const err = error as Error;

        // Should convert object to string in message
        expect(err.message).toContain('Error evaluating module "object-error.js"');
      }
    });

    it('should handle null/undefined errors', () => {
      const code = 'throw null;';
      const runtime = createMockRuntime();

      try {
        evaluateModule(code, 'null-error.js', runtime);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        const err = error as Error;

        expect(err.message).toContain('Error evaluating module "null-error.js"');
      }
    });

    it('should include module ID in error message', () => {
      const code = 'throw new Error("test");';
      const runtime = createMockRuntime();

      try {
        evaluateModule(code, '/path/to/my-module.tsx', runtime);
      } catch (error) {
        const err = error as Error;
        expect(err.message).toContain('/path/to/my-module.tsx');
      }
    });

    it('should handle syntax errors', () => {
      // This will cause a syntax error when evaluating
      const code = 'const x = {;'; // Invalid syntax
      const runtime = createMockRuntime();

      expect(() => evaluateModule(code, 'syntax-error.js', runtime)).toThrow();

      try {
        evaluateModule(code, 'syntax-error.js', runtime);
      } catch (error) {
        const err = error as Error & { cause?: Error };

        expect(err.message).toContain('Error evaluating module "syntax-error.js"');
        expect(err.cause).toBeDefined();
      }
    });

    it('should handle reference errors', () => {
      const code = 'undefinedVariable.foo();';
      const runtime = createMockRuntime();

      try {
        evaluateModule(code, 'ref-error.js', runtime);
      } catch (error) {
        const err = error as Error & { cause?: Error };

        expect(err.message).toContain('Error evaluating module "ref-error.js"');
        expect(err.cause).toBeDefined();
        expect(err.cause?.message).toContain('undefinedVariable');
      }
    });
  });

  describe('error chain utilities integration', () => {
    it('should create proper error chain for nested errors', () => {
      // Simulate a module that catches and re-throws
      const code = `
        try {
          throw new Error("inner error");
        } catch (e) {
          const wrapped = new Error("outer error");
          wrapped.cause = e;
          throw wrapped;
        }
      `;
      const runtime = createMockRuntime();

      try {
        evaluateModule(code, 'nested.js', runtime);
      } catch (error) {
        const err = error as Error & { cause?: Error & { cause?: Error } };

        // Top level: evaluateModule wrapper
        expect(err.message).toContain('Error evaluating module');

        // First cause: "outer error"
        expect(err.cause?.message).toBe('outer error');

        // Second cause: "inner error"
        expect(err.cause?.cause?.message).toBe('inner error');
      }
    });
  });
});
