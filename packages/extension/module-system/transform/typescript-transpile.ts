// packages/extension/module-system/transform/typescript-transpile.ts
// Unified TypeScript transpilation helper
//
// This module centralizes TypeScript transpilation logic to eliminate duplication
// between transformEntry() & transform() functions in transform.ts.

import { transpileModule as tsTranspileModule } from 'typescript';
import type { Preview } from '../../preview/preview-manager';
import { resolveTypescriptConfig } from '../../preview/config';

// * transpile TypeScript/TSX code using the workspace's tsconfig
export function transpileTypeScript(
  code: string,
  fsPath: string,
  preview: Preview
): string {
  // Lazily resolve TypeScript configuration
  if (!preview.typescriptConfiguration) {
    preview.typescriptConfiguration = resolveTypescriptConfig(null);
  }

  const { tsCompilerOptions } = preview.typescriptConfiguration;

  return tsTranspileModule(code, {
    compilerOptions: tsCompilerOptions,
    fileName: fsPath,
  }).outputText;
}

// check if file extension indicates TypeScript (.ts or .tsx, case-insensitive)
export function isTypeScriptExtension(extname: string): boolean {
  return /\.tsx?$/i.test(extname);
}

// check if VS Code language ID indicates TypeScript
export function isTypeScriptLanguage(languageId: string): boolean {
  return languageId === 'typescript' || languageId === 'typescriptreact';
}
