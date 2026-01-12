// packages/extension/test/transpiler-selector.test.ts
// tests for transpiler-selector - verifies Sucrase/Babel selection and fallback behavior

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { transpileWithFallback } from '../transpiler/transpiler-selector';

// mock the transpilers
vi.mock('../transpiler/babel', () => ({
  transformAsync: vi.fn(),
}));

vi.mock('../transpiler/sucrase', () => ({
  transform: vi.fn(),
}));

vi.mock('../logging', () => ({
  debug: vi.fn(),
}));

import { transformAsync as babelTransformAsync } from '../transpiler/babel';
import { transform as sucraseTransform } from '../transpiler/sucrase';

describe('transpiler-selector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('transpileWithFallback', () => {
    it('uses Babel directly when useSucrase is false', async () => {
      const inputCode = 'const x = 1;';
      const outputCode = 'var x = 1;';

      vi.mocked(babelTransformAsync).mockResolvedValue({
        code: outputCode,
      } as any);

      const result = await transpileWithFallback(inputCode, {
        useSucrase: false,
        context: 'test',
      });

      expect(result).toBe(outputCode);
      expect(babelTransformAsync).toHaveBeenCalledWith(inputCode);
      expect(sucraseTransform).not.toHaveBeenCalled();
    });

    it('uses Sucrase when useSucrase is true and Sucrase succeeds', async () => {
      const inputCode = 'const x = 1;';
      const outputCode = 'var x = 1;';

      vi.mocked(sucraseTransform).mockReturnValue({
        code: outputCode,
      } as any);

      const result = await transpileWithFallback(inputCode, {
        useSucrase: true,
        context: 'test',
      });

      expect(result).toBe(outputCode);
      expect(sucraseTransform).toHaveBeenCalledWith(inputCode);
      expect(babelTransformAsync).not.toHaveBeenCalled();
    });

    it('falls back to Babel when Sucrase fails', async () => {
      const inputCode = 'const x = 1;';
      const babelOutput = 'var x = 1;';

      vi.mocked(sucraseTransform).mockImplementation(() => {
        throw new Error('Sucrase parse error');
      });

      vi.mocked(babelTransformAsync).mockResolvedValue({
        code: babelOutput,
      } as any);

      const result = await transpileWithFallback(inputCode, {
        useSucrase: true,
        context: 'test',
        filePath: '/test/file.ts',
      });

      expect(result).toBe(babelOutput);
      expect(sucraseTransform).toHaveBeenCalledWith(inputCode);
      expect(babelTransformAsync).toHaveBeenCalledWith(inputCode);
    });

    it('returns original code when Babel returns null', async () => {
      const inputCode = 'const x = 1;';

      vi.mocked(babelTransformAsync).mockResolvedValue(null);

      const result = await transpileWithFallback(inputCode, {
        useSucrase: false,
        context: 'test',
      });

      expect(result).toBe(inputCode);
    });

    it('returns original code when Babel result has no code', async () => {
      const inputCode = 'const x = 1;';

      vi.mocked(babelTransformAsync).mockResolvedValue({
        code: undefined,
      } as any);

      const result = await transpileWithFallback(inputCode, {
        useSucrase: false,
        context: 'test',
      });

      expect(result).toBe(inputCode);
    });

    it('returns original code when Sucrase fails and Babel returns null', async () => {
      const inputCode = 'const x = 1;';

      vi.mocked(sucraseTransform).mockImplementation(() => {
        throw new Error('Sucrase parse error');
      });

      vi.mocked(babelTransformAsync).mockResolvedValue(null);

      const result = await transpileWithFallback(inputCode, {
        useSucrase: true,
        context: 'test',
      });

      expect(result).toBe(inputCode);
    });

    it('handles JSX code correctly', async () => {
      const inputCode = 'const App = () => <div>Hello</div>;';
      const outputCode =
        'var App = function() { return React.createElement("div", null, "Hello"); };';

      vi.mocked(sucraseTransform).mockReturnValue({
        code: outputCode,
      } as any);

      const result = await transpileWithFallback(inputCode, {
        useSucrase: true,
        context: 'entry',
      });

      expect(result).toBe(outputCode);
      expect(sucraseTransform).toHaveBeenCalledWith(inputCode);
    });

    it('handles TypeScript code correctly', async () => {
      const inputCode = 'const x: number = 1;';
      const outputCode = 'var x = 1;';

      vi.mocked(babelTransformAsync).mockResolvedValue({
        code: outputCode,
      } as any);

      const result = await transpileWithFallback(inputCode, {
        useSucrase: false,
        context: 'dependency',
        filePath: '/test/file.ts',
      });

      expect(result).toBe(outputCode);
    });

    it('uses default context when not provided', async () => {
      const inputCode = 'const x = 1;';
      const outputCode = 'var x = 1;';

      vi.mocked(babelTransformAsync).mockResolvedValue({
        code: outputCode,
      } as any);

      // Should not throw when context is not provided
      const result = await transpileWithFallback(inputCode, {
        useSucrase: false,
      });

      expect(result).toBe(outputCode);
    });
  });
});
