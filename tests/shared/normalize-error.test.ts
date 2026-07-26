// tests/shared/normalize-error.test.ts
// verify unknown errors retain useful messages & remote stacks

import { describe, expect, it } from 'vitest';
import { normalizeError } from '../../packages/runtime-utils/src/errors/normalize';

describe('normalizeError', () => {
  it('normalizes representative messages and preserves string stacks', () => {
    const cases: Array<{
      input: unknown;
      message: string;
      stack?: string;
    }> = [
      { input: 'string failure', message: 'string failure' },
      {
        input: { message: 'remote failure', stack: 'remote stack' },
        message: 'remote failure',
        stack: 'remote stack',
      },
      { input: { code: 'E_FAILURE' }, message: 'Unknown error' },
      { input: null, message: 'Unknown error' },
    ];

    for (const testCase of cases) {
      const normalized = normalizeError(testCase.input);
      expect(normalized).toBeInstanceOf(Error);
      expect(normalized.message).toBe(testCase.message);
      if (testCase.stack) {
        expect(normalized.stack).toBe(testCase.stack);
      }
    }
  });
});
