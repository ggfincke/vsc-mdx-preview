// packages/extension/module-system/transform/typescript-transpile.ts
// unified TypeScript transpilation helper using Sucrase (lightweight)

import { transform as sucraseTransform } from 'sucrase';
import type { Preview } from '../../preview/preview-manager';

// transpile TypeScript/TSX code using Sucrase
// sucrase is already bundled & provides fast transpilation
export function transpileTypeScript(
  code: string,
  fsPath: string,
  _preview: Preview
): string {
  // determine transforms based on file extension
  const isTsx = fsPath.endsWith('.tsx');
  const transforms: ('typescript' | 'jsx')[] = isTsx
    ? ['typescript', 'jsx']
    : ['typescript'];

  const result = sucraseTransform(code, {
    transforms,
    filePath: fsPath,
    // preserve import/export for subsequent Babel processing
    disableESTransforms: true,
  });

  return result.code;
}

// check if VS Code language ID indicates TypeScript
export function isTypeScriptLanguage(languageId: string): boolean {
  return languageId === 'typescript' || languageId === 'typescriptreact';
}

// check if file extension indicates TypeScript
export function isTypeScriptExtension(ext: string): boolean {
  return ext === '.ts' || ext === '.tsx';
}
