// tests/webview/evaluateModule.test.ts
// Unit tests for evaluateModule error handling w/ stack preservation

import { describe, it, expect, vi } from 'vitest';
import { evaluateModule } from '../../packages/webview-client/src/features/module-runtime/eval/evaluateModule';
import type { ModuleRuntime } from '../../packages/webview-client/src/features/module-runtime/types';

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
    it('should evaluate CJS module and return exports', () => {
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

      try {
        evaluateModule(code, 'error-test.js', runtime);
      } catch (error: unknown) {
        const err = error as Error & { cause?: Error };

        expect(err.message).toContain(
          'Error evaluating module "error-test.js"'
        );
        expect(err.message).toContain('original error message');
        expect(err.cause).toBeInstanceOf(Error);
        expect(err.cause?.message).toBe('original error message');
      }
    });

    it('should include original stack in error stack', () => {
      const code = 'throw new Error("stack test error");';
      const runtime = createMockRuntime();

      try {
        evaluateModule(code, 'stack-test.js', runtime);
      } catch (error: unknown) {
        const err = error as Error;
        expect(err.stack).toContain('caused by:');
        expect(err.stack).toContain('stack test error');
      }
    });

    it('should handle string errors (not Error instances)', () => {
      const code = 'throw "string error";';
      const runtime = createMockRuntime();

      try {
        evaluateModule(code, 'string-error.js', runtime);
      } catch (error: unknown) {
        const err = error as Error & { cause?: Error };

        expect(err.message).toContain('string error');
        expect(err.cause).toBeInstanceOf(Error);
        expect(err.cause?.message).toBe('string error');
      }
    });

    it('should handle syntax errors', () => {
      const code = 'const x = {;';
      const runtime = createMockRuntime();

      expect(() => evaluateModule(code, 'syntax-error.js', runtime)).toThrow();

      try {
        evaluateModule(code, 'syntax-error.js', runtime);
      } catch (error: unknown) {
        const err = error as Error & { cause?: Error };

        expect(err.message).toContain(
          'Error evaluating module "syntax-error.js"'
        );
        expect(err.cause).toBeDefined();
      }
    });

    it('should handle reference errors', () => {
      const code = 'undefinedVariable.foo();';
      const runtime = createMockRuntime();

      try {
        evaluateModule(code, 'ref-error.js', runtime);
      } catch (error: unknown) {
        const err = error as Error & { cause?: Error };

        expect(err.message).toContain('Error evaluating module "ref-error.js"');
        expect(err.cause?.message).toContain('undefinedVariable');
      }
    });
  });
});
