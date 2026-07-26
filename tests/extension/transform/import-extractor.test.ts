// tests/extension/transform/import-extractor.test.ts
// verify mixed module syntax extraction stays ordered & ignores inert text

import { describe, expect, it } from 'vitest';
import { extractImportSpecifiers } from '../../../packages/extension-host/src/features/module-runtime/dependencies/import-extractor';

describe('mixed import extraction', () => {
  it('extracts ESM & CommonJS specifiers in source order with dedupe', async () => {
    const code = `
      const first = require('first');
      import second from 'second';
      const duplicate = require('second');
      // require('comment-only');
      const inert = "require('string-only')";
      export { third } from 'third';
    `;

    await expect(extractImportSpecifiers(code)).resolves.toEqual([
      'first',
      'second',
      'third',
    ]);
  });
});
