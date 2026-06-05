// packages/extension-host/src/features/module-runtime/transform/typescript-transpile.ts
// unified TypeScript transpilation helper using Sucrase (lightweight)

import { sucraseTransform } from './sucrase';
import type { Preview } from '../../preview/preview-manager';
import { TS_EXTENSIONS } from '../../../shared/constants';

// transpile TypeScript/TSX code using Sucrase
// use bundled sucrase for fast transpilation
export function transpileTypeScript(
  code: string,
  fsPath: string,
  _preview: Preview
): string {
  // determine transforms based on file extension (.tsx is TS_EXTENSIONS[1])
  const isTsx = fsPath.endsWith(TS_EXTENSIONS[1]);
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
  return (TS_EXTENSIONS as readonly string[]).includes(ext);
}
