// packages/extension/module-system/handlers/result-builders.ts
// Builder functions for constructing FetchResult objects consistently
//
// These factory functions standardize FetchResult construction across all handlers,
// ensuring consistent field population & reducing inline object literal boilerplate.

import type { FetchResult } from '@mdx-preview/shared';

// build a FetchResult for CSS content (no JavaScript code)
export function buildCssResult(fsPath: string, css: string): FetchResult {
  return {
    fsPath,
    css,
    code: '',
    dependencies: [],
  };
}

// build a FetchResult for a CommonJS module export (JSON & image files)
export function buildModuleExportResult(
  fsPath: string,
  exportValue: string
): FetchResult {
  return {
    fsPath,
    code: `module.exports = ${exportValue}`,
    dependencies: [],
  };
}

// build a FetchResult for transpiled script code w/ dependencies
export function buildScriptResult(
  fsPath: string,
  code: string,
  dependencies: string[]
): FetchResult {
  return {
    fsPath,
    code,
    dependencies,
  };
}
