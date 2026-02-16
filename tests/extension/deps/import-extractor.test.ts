// tests/extension/deps/import-extractor.test.ts
// verify import extraction covers major syntax categories & false positives

import { describe, it, expect } from 'vitest';
import { extractImportSpecifiers } from '../../../packages/extension-host/src/features/module-runtime/dependencies/import-extractor';

describe('extractImportSpecifiers', () => {
  it('extracts ESM imports (default, named, star, side-effect)', async () => {
    const code = `
      import React from 'react';
      import { useState } from 'react';
      import * as lodash from 'lodash';
      import './styles.css';
    `;
    const result = await extractImportSpecifiers(code);
    expect(result).toContain('react');
    expect(result).toContain('lodash');
    expect(result).toContain('./styles.css');
  });

  it('extracts dynamic imports', async () => {
    const code = `
      const module = await import('./dynamic-module');
      import('./lazy-component').then(m => m.default);
      const LazyComponent = React.lazy(() => import('./LazyComponent'));
    `;
    const result = await extractImportSpecifiers(code);
    expect(result).toContain('./dynamic-module');
    expect(result).toContain('./lazy-component');
    expect(result).toContain('./LazyComponent');
  });

  it('extracts TypeScript type imports', async () => {
    const code = `
      import type { Props } from './types';
      import React, { type FC, useState } from 'react';
    `;
    const result = await extractImportSpecifiers(code);
    expect(result).toContain('./types');
    expect(result).toContain('react');
  });

  it('extracts re-exports', async () => {
    const code = `
      export * from './utils';
      export { foo as bar } from './module';
      export { default } from './component';
    `;
    const result = await extractImportSpecifiers(code);
    expect(result).toContain('./utils');
    expect(result).toContain('./module');
    expect(result).toContain('./component');
  });

  it('extracts CommonJS requires', async () => {
    const code = `
      const fs = require('fs');
      const { readFile } = require('fs/promises');
    `;
    const result = await extractImportSpecifiers(code);
    expect(result).toContain('fs');
    expect(result).toContain('fs/promises');
  });

  it('handles scoped packages & subpath imports', async () => {
    const code = `
      import { Button } from '@mui/material/Button';
      import { readFile } from 'node:fs/promises';
    `;
    const result = await extractImportSpecifiers(code);
    expect(result).toContain('@mui/material/Button');
    expect(result).toContain('node:fs/promises');
  });

  describe('false positive prevention', () => {
    it('ignores import-like text in strings & comments', async () => {
      const code = `
        const str = "import x from 'y'";
        // import x from 'z';
        /* import a from 'b'; */
      `;
      const result = await extractImportSpecifiers(code);
      expect(result).toEqual([]);
    });

    it('returns empty array for code w/o imports', async () => {
      expect(await extractImportSpecifiers('')).toEqual([]);
      expect(
        await extractImportSpecifiers('const x = 1; console.log(x);')
      ).toEqual([]);
    });
  });

  describe('mixed & edge cases', () => {
    it('handles mixed ESM & dynamic imports (ESM takes precedence over CJS)', async () => {
      const code = `
        import React from 'react';
        import './styles.css';
        const lodash = require('lodash');
        export { helper } from './utils';
        const lazy = import('./lazy');
      `;
      const result = await extractImportSpecifiers(code);
      expect(result).toContain('react');
      expect(result).toContain('./styles.css');
      expect(result).toContain('./utils');
      expect(result).toContain('./lazy');
    });

    it('handles export-only files w/ no imports', async () => {
      const code = `
        export * from './a';
        export * from './b';
        export { default as Button } from './Button';
      `;
      const result = await extractImportSpecifiers(code);
      expect(result).toContain('./a');
      expect(result).toContain('./b');
      expect(result).toContain('./Button');
    });
  });
});
