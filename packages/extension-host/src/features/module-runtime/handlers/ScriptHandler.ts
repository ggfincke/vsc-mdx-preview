// packages/extension-host/src/features/module-runtime/handlers/ScriptHandler.ts
// handler for JavaScript/TypeScript files - delegate to transform.ts

import type { FetchResult } from '@mdx-preview/contracts';
import type { Preview } from '../../preview/preview-manager';
import type { FileTypeHandler } from './index';
import { transform } from '../transform/transform';
import { extractImportSpecifiers } from '../dependencies/import-extractor';
import { buildScriptResult } from './result-builders';
import { SCRIPTABLE_EXTENSIONS } from '../../../shared/constants';

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

    // retain source imports & append helpers emitted by the transpiler
    const sourceDependencies = await extractImportSpecifiers(esmCode);
    const transformedDependencies =
      await extractImportSpecifiers(transformedCode);
    const dependencies = [
      ...new Set([...sourceDependencies, ...transformedDependencies]),
    ];

    return buildScriptResult(fsPath, transformedCode, dependencies);
  }
}
