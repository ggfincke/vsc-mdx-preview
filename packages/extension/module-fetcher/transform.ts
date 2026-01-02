// packages/extension/module-fetcher/transform.ts
// transpile entry & dependency files using MDX, TypeScript, Babel, or Sucrase

import { Preview } from '../preview/preview-manager';
import * as path from 'path';
import isModule from 'is-module';
import { mdxTranspileAsync } from '../transpiler/mdx/mdx';
import { transpileModule as tsTranspileModule } from 'typescript';
import { transformAsync as babelTransformAsync } from '../transpiler/babel';
import { transform as sucraseTransform } from '../transpiler/sucrase';
import { debug } from '../logging';

// transform entry file (MDX → TS → Babel/Sucrase)
async function transformEntry(
  code: string,
  fsPath: string,
  preview: Preview
): Promise<string> {
  const { languageId, uri } = preview.doc;
  if (
    languageId === 'markdown' ||
    languageId === 'mdx' ||
    uri.scheme === 'untitled'
  ) {
    code = await mdxTranspileAsync(code, true, preview);
  }

  const useSucrase = preview.configuration.useSucraseTranspiler;
  if (
    (languageId === 'typescript' || languageId === 'typescriptreact') &&
    !useSucrase
  ) {
    if (!preview.typescriptConfiguration) {
      preview.generateTypescriptConfiguration(null);
    }
    const { tsCompilerOptions } = preview.typescriptConfiguration!;
    code = tsTranspileModule(code, {
      compilerOptions: tsCompilerOptions,
      fileName: fsPath,
    }).outputText;
  }

  if (useSucrase) {
    try {
      code = sucraseTransform(code).code;
    } catch {
      const result = await babelTransformAsync(code);
      code = result?.code ?? code;
    }
  } else {
    const result = await babelTransformAsync(code);
    code = result?.code ?? code;
  }

  return code;
}

// transform dependency file (MDX → TS → Babel/Sucrase, skip node_modules unless ESM)
async function transform(
  code: string,
  fsPath: string,
  preview: Preview
): Promise<string> {
  const extname = path.extname(fsPath);
  if (/\.mdx?$/i.test(extname)) {
    code = await mdxTranspileAsync(code, false, preview);
  }

  const useSucrase = preview.configuration.useSucraseTranspiler;
  if (/\.tsx?$/i.test(extname) && !useSucrase) {
    if (!preview.typescriptConfiguration) {
      preview.generateTypescriptConfiguration(null);
    }
    const { tsCompilerOptions } = preview.typescriptConfiguration!;
    code = tsTranspileModule(code, {
      compilerOptions: tsCompilerOptions,
      fileName: fsPath,
    }).outputText;
  }

  const isInNodeModules = fsPath.split(path.sep).includes('node_modules');
  if (!isInNodeModules || isModule(code)) {
    debug(`Transpiling: ${fsPath}`);
    if (isInNodeModules || useSucrase) {
      try {
        code = sucraseTransform(code).code;
      } catch {
        const result = await babelTransformAsync(code);
        code = result?.code ?? code;
      }
    } else {
      const result = await babelTransformAsync(code);
      code = result?.code ?? code;
    }
  }

  return code;
}

export { transformEntry, transform };
