// packages/extension/module-system/handlers/ScriptHandler.ts
// handler for JavaScript/TypeScript files - delegate to transform.ts

import type { FetchResult } from '@mdx-preview/shared';
import type { Preview } from '../../preview/preview-manager';
import type { FileTypeHandler } from './index';
import { transform } from '../transform/transform';
import { extractImportSpecifiers } from '../deps/import-extractor';
import { buildScriptResult } from './result-builders';
import { SCRIPTABLE_EXTENSIONS } from '../../constants';

// handler for JavaScript/TypeScript files - delegate transpilation to transform.ts & extract dependencies
export class ScriptHandler implements FileTypeHandler {
  // handle JS, JSX, TS, TSX, MJS, CJS, & MDX files
  extensions = [...SCRIPTABLE_EXTENSIONS];

  async handle(
    code: string,
    fsPath: string,
    preview: Preview
  ): Promise<FetchResult> {
    // transform the code (handles MDX, TypeScript, JSX, etc.)
    // I.1: get both esmCode & final code from transform
    const { code: transformedCode, esmCode } = await transform(
      code,
      fsPath,
      preview
    );

    // I.1: extract import dependencies from ESM code (before CommonJS conversion)
    // es-module-lexer works much better on ESM than on CommonJS output
    const importNames = await extractImportSpecifiers(esmCode);
    const dependencies = importNames.filter(
      (dep): dep is string => dep !== undefined && dep !== null
    );

    return buildScriptResult(fsPath, transformedCode, dependencies);
  }
}
