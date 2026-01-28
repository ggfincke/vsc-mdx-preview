// packages/extension/module-system/handlers/ScriptHandler.ts
// handler for JavaScript/TypeScript files - delegates to transform.ts

import type { FetchResult } from '@mdx-preview/shared';
import type { Preview } from '../../preview/preview-manager';
import type { FileTypeHandler } from './index';
import { transform } from '../transform/transform';
import { extractImports } from '../deps/import-extractor';
import { buildScriptResult } from './result-builders';

// handler for JavaScript/TypeScript files - delegates transpilation to transform.ts & extracts dependencies
export class ScriptHandler implements FileTypeHandler {
  // handle JS, JSX, TS, TSX, MJS, CJS, & MDX files
  extensions = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.mdx', '.md'];

  async handle(
    code: string,
    fsPath: string,
    preview: Preview
  ): Promise<FetchResult> {
    // transform the code (handles MDX, TypeScript, JSX, etc.)
    // I.1: transform now returns both esmCode & final code
    const { code: transformedCode, esmCode } = await transform(
      code,
      fsPath,
      preview
    );

    // I.1: extract import dependencies from ESM code (BEFORE CommonJS conversion)
    // es-module-lexer works much better on ESM than on CommonJS output
    const importNames = await extractImports(esmCode);
    const dependencies = importNames.filter(
      (dep): dep is string => dep !== undefined && dep !== null
    );

    return buildScriptResult(fsPath, transformedCode, dependencies);
  }
}
