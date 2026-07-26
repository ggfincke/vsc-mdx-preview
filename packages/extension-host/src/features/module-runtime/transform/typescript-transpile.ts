// packages/extension-host/src/features/module-runtime/transform/typescript-transpile.ts
// unified TypeScript transpilation helper using Sucrase (lightweight)

import * as path from 'path';
import { sucraseTransform } from './sucrase';
import { TS_EXTENSIONS } from '../../../shared/constants';

// transpile TypeScript/TSX code using Sucrase
// use bundled sucrase for fast transpilation
export function transpileTypeScript(code: string, fsPath: string): string {
  const extension = path.extname(fsPath).toLowerCase();
  const transforms: ('typescript' | 'jsx')[] =
    extension === TS_EXTENSIONS[1]
      ? ['typescript', 'jsx']
      : ['typescript'];
  const result = sucraseTransform(code, {
    transforms,
    filePath: fsPath,
    // preserve JSX & modules for the automatic-runtime Babel pass
    disableESTransforms: true,
    jsxRuntime: 'preserve',
  });

  return result.code;
}

// check if VS Code language ID indicates TypeScript
export function isTypeScriptLanguage(languageId: string): boolean {
  return languageId === 'typescript' || languageId === 'typescriptreact';
}

// check if file extension indicates TypeScript
export function isTypeScriptExtension(ext: string): boolean {
  const normalizedExtension = ext.toLowerCase();
  return (TS_EXTENSIONS as readonly string[]).includes(normalizedExtension);
}
