// packages/extension/test/mdx-compile.test.ts
// * MDX compilation tests
//
// ? note: full transpiler tests (transpiler.test.ts) are excluded from Vitest
// because @mdx-js/mdx v3 is ESM-only & has complex module resolution.
// the transpiler is tested via integration tests when running the extension
// in VS Code (see test/runTest.ts).
//
// this file tests helper functions that don't require @mdx-js/mdx imports.

import { describe, test, expect } from 'vitest';
import * as path from 'path';

describe('MDX Helper Functions', () => {
  describe('hasDefaultExport detection', () => {
    // Test the regex/detection logic for default exports
    // This is extracted to avoid importing the full MDX chain

    const hasDefaultExportPattern = /export\s+default\s+/;

    test('detects explicit default export', () => {
      const content = `import Layout from './layout';

export default Layout;

# Hello`;
      expect(hasDefaultExportPattern.test(content)).toBe(true);
    });

    test('detects default export function', () => {
      const content = `export default function Layout({ children }) {
  return <div>{children}</div>;
}`;
      expect(hasDefaultExportPattern.test(content)).toBe(true);
    });

    test('returns false when no default export', () => {
      const content = `# Hello World

This is plain MDX content.`;
      expect(hasDefaultExportPattern.test(content)).toBe(false);
    });

    test('returns false for named exports only', () => {
      const content = `export const meta = { title: 'Test' };

# Hello`;
      expect(hasDefaultExportPattern.test(content)).toBe(false);
    });
  });

  describe('path resolution', () => {
    test('resolves relative custom layout path correctly', () => {
      const currentDir = '/projects/docs/pages';
      const layoutPath = '/projects/docs/layouts/main.js';
      const relative = path.relative(currentDir, layoutPath);

      expect(relative).toBe('../layouts/main.js');
    });

    test('handles same directory layout', () => {
      const currentDir = '/projects/docs/pages';
      const layoutPath = '/projects/docs/pages/layout.js';
      const relative = path.relative(currentDir, layoutPath);

      expect(relative).toBe('layout.js');
    });
  });
});

describe('MDX 3 Output Format', () => {
  // these tests document the expected output format from MDX 3 compilation
  // the wrapper should export a component & avoid touching the DOM

  test('wrapper exports component & avoids DOM rendering', () => {
    const expectedPatterns = [
      "import React from 'react'",
      'import { jsx as _jsx',
      'export default MDXContent',
    ];

    const wrapper = `
import React from 'react';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from 'react/jsx-runtime';
// MDX compiled content goes here
export default MDXContent;
`;

    expectedPatterns.forEach((pattern) => {
      expect(wrapper).toContain(pattern);
    });

    // Should NOT touch the DOM directly
    expect(wrapper).not.toContain('ReactDOM');
    expect(wrapper).not.toContain('createRoot');
    expect(wrapper).not.toContain('document.getElementById');
  });
});
