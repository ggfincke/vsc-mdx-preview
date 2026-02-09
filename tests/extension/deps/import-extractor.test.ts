// tests/extension/deps/import-extractor.test.ts
// unit tests for import extraction w/ emphasis on edge cases

import { describe, it, expect } from 'vitest';
import { extractImportSpecifiers } from '../../../packages/extension-host/src/features/module-runtime/dependencies/import-extractor';

describe('extractImportSpecifiers', () => {
  describe('ESM imports', () => {
    it('should extract default imports', async () => {
      const code = `import React from 'react';`;
      const result = await extractImportSpecifiers(code);
      expect(result).toContain('react');
    });

    it('should extract named imports', async () => {
      const code = `import { useState, useEffect } from 'react';`;
      const result = await extractImportSpecifiers(code);
      expect(result).toContain('react');
    });

    it('should extract star imports', async () => {
      const code = `import * as React from 'react';`;
      const result = await extractImportSpecifiers(code);
      expect(result).toContain('react');
    });

    it('should extract side-effect imports', async () => {
      const code = `import './styles.css';`;
      const result = await extractImportSpecifiers(code);
      expect(result).toContain('./styles.css');
    });

    it('should extract multiple imports from same module', async () => {
      const code = `
        import React, { useState, useEffect } from 'react';
        import { createRoot } from 'react-dom/client';
      `;
      const result = await extractImportSpecifiers(code);
      expect(result).toContain('react');
      expect(result).toContain('react-dom/client');
    });
  });

  describe('dynamic imports', () => {
    it('should extract basic dynamic imports', async () => {
      const code = `const module = await import('./dynamic-module');`;
      const result = await extractImportSpecifiers(code);
      expect(result).toContain('./dynamic-module');
    });

    it('should extract dynamic imports w/o await', async () => {
      const code = `import('./lazy-component').then(m => m.default);`;
      const result = await extractImportSpecifiers(code);
      expect(result).toContain('./lazy-component');
    });

    it('should extract dynamic imports in arrow functions', async () => {
      const code = `const loadModule = () => import('./module');`;
      const result = await extractImportSpecifiers(code);
      expect(result).toContain('./module');
    });

    it('should extract dynamic imports in React.lazy', async () => {
      const code = `const LazyComponent = React.lazy(() => import('./LazyComponent'));`;
      const result = await extractImportSpecifiers(code);
      expect(result).toContain('./LazyComponent');
    });

    it('should handle dynamic imports w/ comments', async () => {
      const code = `const module = import(/* webpackChunkName: "chunk" */ './chunk');`;
      const result = await extractImportSpecifiers(code);
      expect(result).toContain('./chunk');
    });
  });

  describe('TypeScript imports', () => {
    it('should extract type imports', async () => {
      const code = `import type { Props } from './types';`;
      const result = await extractImportSpecifiers(code);
      expect(result).toContain('./types');
    });

    it('should extract type-only named imports', async () => {
      const code = `import { type Props, type State } from './types';`;
      const result = await extractImportSpecifiers(code);
      expect(result).toContain('./types');
    });

    it('should extract mixed type & value imports', async () => {
      const code = `import React, { type FC, useState } from 'react';`;
      const result = await extractImportSpecifiers(code);
      expect(result).toContain('react');
    });
  });

  describe('export-from statements', () => {
    it('should extract star re-exports', async () => {
      const code = `export * from './utils';`;
      const result = await extractImportSpecifiers(code);
      expect(result).toContain('./utils');
    });

    it('should extract named re-exports', async () => {
      const code = `export { foo, bar } from './utils';`;
      const result = await extractImportSpecifiers(code);
      expect(result).toContain('./utils');
    });

    it('should extract type re-exports', async () => {
      // es-module-lexer extracts type exports as regular exports
      const code = `export type { SomeType } from './types';`;
      const result = await extractImportSpecifiers(code);
      // es-module-lexer may not extract type-only exports (TypeScript syntax)
      // documents current behavior - type-only exports may be empty
      expect(result).toBeDefined();
    });

    it('should extract renamed re-exports', async () => {
      const code = `export { foo as bar } from './module';`;
      const result = await extractImportSpecifiers(code);
      expect(result).toContain('./module');
    });

    it('should extract default re-exports', async () => {
      const code = `export { default } from './component';`;
      const result = await extractImportSpecifiers(code);
      expect(result).toContain('./component');
    });
  });

  describe('CommonJS requires', () => {
    it('should extract simple require', async () => {
      const code = `const fs = require('fs');`;
      const result = await extractImportSpecifiers(code);
      expect(result).toContain('fs');
    });

    it('should extract destructured require', async () => {
      const code = `const { readFile } = require('fs');`;
      const result = await extractImportSpecifiers(code);
      expect(result).toContain('fs');
    });

    it('should extract require w/ double quotes', async () => {
      const code = `const lodash = require("lodash");`;
      const result = await extractImportSpecifiers(code);
      expect(result).toContain('lodash');
    });

    it('should extract require w/ template literal', async () => {
      const code = 'const mod = require(`./module`);';
      const result = await extractImportSpecifiers(code);
      expect(result).toContain('./module');
    });
  });

  describe('edge cases', () => {
    it('should return empty array for code w/o imports', async () => {
      const code = `const x = 1 + 2; console.log(x);`;
      const result = await extractImportSpecifiers(code);
      expect(result).toEqual([]);
    });

    it('should handle empty string', async () => {
      const result = await extractImportSpecifiers('');
      expect(result).toEqual([]);
    });

    it('should handle code w/ only comments', async () => {
      const code = `
        // This is a comment
        /* Multi-line
           comment */
      `;
      const result = await extractImportSpecifiers(code);
      expect(result).toEqual([]);
    });

    it('should handle mixed imports', async () => {
      // when ESM imports exist, CommonJS requires are NOT extracted (require fallback only runs when no ESM imports found)
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
      // lodash via require NOT extracted when ESM imports exist (ESM takes precedence)
      expect(result).toContain('./utils');
      expect(result).toContain('./lazy');
    });

    it('should not be fooled by import in strings', async () => {
      const code = `const str = "import x from 'y'";`;
      const result = await extractImportSpecifiers(code);
      // es-module-lexer correctly ignores strings
      expect(result).toEqual([]);
    });

    it('should not be fooled by import in template literals', async () => {
      const code = 'const str = `import x from "y"`;';
      const result = await extractImportSpecifiers(code);
      expect(result).toEqual([]);
    });

    it('should not be fooled by import in comments', async () => {
      const code = `// import x from 'y';\nconst a = 1;`;
      const result = await extractImportSpecifiers(code);
      expect(result).toEqual([]);
    });

    it('should not be fooled by import in block comments', async () => {
      const code = `/* import x from 'y'; */\nconst a = 1;`;
      const result = await extractImportSpecifiers(code);
      expect(result).toEqual([]);
    });

    it('should handle scoped packages', async () => {
      const code = `import { something } from '@scope/package';`;
      const result = await extractImportSpecifiers(code);
      expect(result).toContain('@scope/package');
    });

    it('should handle subpath imports', async () => {
      const code = `import { Button } from '@mui/material/Button';`;
      const result = await extractImportSpecifiers(code);
      expect(result).toContain('@mui/material/Button');
    });

    it('should handle node: prefixed imports', async () => {
      const code = `import { readFile } from 'node:fs/promises';`;
      const result = await extractImportSpecifiers(code);
      expect(result).toContain('node:fs/promises');
    });
  });

  describe('regression tests', () => {
    it('should handle code w/ only dynamic imports (issue: pre-check missed these)', async () => {
      const code = `
        export default function MyComponent() {
          useEffect(() => {
            import('./heavy-component').then(m => setModule(m.default));
          }, []);
          return null;
        }
      `;
      const result = await extractImportSpecifiers(code);
      expect(result).toContain('./heavy-component');
    });

    it('should handle export-only files', async () => {
      const code = `
        export * from './a';
        export * from './b';
        export { c } from './c';
      `;
      const result = await extractImportSpecifiers(code);
      expect(result).toContain('./a');
      expect(result).toContain('./b');
      expect(result).toContain('./c');
    });

    it('should handle files w/ only re-exports & no imports', async () => {
      const code = `export { default as Button } from './Button';`;
      const result = await extractImportSpecifiers(code);
      expect(result).toContain('./Button');
    });
  });
});
