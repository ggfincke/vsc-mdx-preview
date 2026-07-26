// packages/extension-host/src/features/module-runtime/handlers/ScriptHandler.ts
// handler for JavaScript/TypeScript files - delegate to transform.ts

import type { FetchResult } from '@mdx-preview/contracts';
import type {
  FileTypeHandler,
  ModuleExecutionContext,
} from '../types/handlers';
import { transform } from '../transform/transform';
import { extractModuleDependencies } from '../dependencies/import-extractor';
import { buildScriptResult } from './result-builders';
import { SCRIPTABLE_EXTENSIONS } from '../../../shared/constants';

// handler for JavaScript/TypeScript files - delegate transpilation to transform.ts & extract dependencies
export class ScriptHandler implements FileTypeHandler {
  // handle JS, JSX, TS, TSX, MJS, CJS, & MDX files
  extensions = [...SCRIPTABLE_EXTENSIONS];

  async handle(
    code: string,
    fsPath: string,
    context: ModuleExecutionContext
  ): Promise<FetchResult> {
    // transform the code (handles MDX, TypeScript, JSX, etc.)
    // I.1: get both esmCode & final code from transform
    const { code: transformedCode, esmCode } = await transform(
      code,
      fsPath,
      context
    );

    // retain source imports & append helpers emitted by the transpiler
    const sourceDependencies = await extractModuleDependencies(esmCode);
    const transformedDependencies =
      await extractModuleDependencies(transformedCode);
    const dependencies = dedupeDependencies([
      ...sourceDependencies,
      ...transformedDependencies,
    ]);

    return buildScriptResult(fsPath, transformedCode, dependencies);
  }
}

function dedupeDependencies(
  dependencies: FetchResult['dependencies']
): FetchResult['dependencies'] {
  const seen = new Set<string>();
  return dependencies.filter((dependency) => {
    const key = JSON.stringify([dependency.specifier, dependency.kind]);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
