// packages/extension/module-fetcher/handlers/ScriptHandler.ts
// handler for JavaScript/TypeScript files - delegates to transform.ts

import type { FetchResult } from '@mdx-preview/shared-types';
import type { Preview } from '../../preview/preview-manager';
import type { FileTypeHandler } from './index';
import { transform } from '../transform';
import { extractImports } from '../import-extractor';

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
    const transformedCode = await transform(code, fsPath, preview);

    // extract import dependencies from transformed code
    const importNames = await extractImports(transformedCode);
    const dependencies = importNames.filter(
      (dep): dep is string => dep !== undefined && dep !== null
    );

    return {
      fsPath,
      code: transformedCode,
      dependencies,
    };
  }
}
