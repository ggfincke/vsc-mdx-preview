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

  it('extracts CommonJS requires', async () => {
    const code = `
      const fs = require('fs');
      const { readFile } = require('fs/promises');
    `;
    const result = await extractImportSpecifiers(code);
    expect(result).toContain('fs');
    expect(result).toContain('fs/promises');
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

  });
});
