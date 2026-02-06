// packages/extension/module-system/handlers/result-builders.ts
// builder functions for constructing FetchResult objects consistently

import type { FetchResult } from '@mdx-preview/shared';
import type { Preview } from '../../preview/preview-manager';
import type { FileTypeHandler } from './index';

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

// create a simple handler that delegates directly to a builder function
export function createSimpleHandler(
  extensions: readonly string[],
  builderFn: (fsPath: string, code: string) => FetchResult
): FileTypeHandler {
  return {
    extensions: [...extensions],
    async handle(
      code: string,
      fsPath: string,
      _preview: Preview
    ): Promise<FetchResult> {
      return builderFn(fsPath, code);
    },
  };
}
