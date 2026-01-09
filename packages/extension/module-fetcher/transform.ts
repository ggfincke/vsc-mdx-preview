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
import { resolveTypescriptConfig } from '../preview/TypeScriptConfigResolver';

// result type for entry transformation (includes frontmatter)
export interface TransformEntryResult {
  code: string;
  frontmatter: Record<string, unknown>;
}

// transform entry file (MDX → TS → Babel/Sucrase)
async function transformEntry(
  code: string,
  fsPath: string,
  preview: Preview
): Promise<TransformEntryResult> {
  const { languageId, uri } = preview.doc;
  // track frontmatter from MDX compilation
  let frontmatter: Record<string, unknown> = {};

  if (
    languageId === 'markdown' ||
    languageId === 'mdx' ||
    uri.scheme === 'untitled'
  ) {
    const mdxResult = await mdxTranspileAsync(code, true, preview);
    code = mdxResult.code;
    frontmatter = mdxResult.frontmatter;
  }

  const useSucrase = preview.configuration.useSucraseTranspiler;
  debug(`Transpiler: ${useSucrase ? 'Sucrase' : 'Babel'} selected for entry`);

  if (
    (languageId === 'typescript' || languageId === 'typescriptreact') &&
    !useSucrase
  ) {
    if (!preview.typescriptConfiguration) {
      preview.typescriptConfiguration = resolveTypescriptConfig(null);
    }
    const { tsCompilerOptions } = preview.typescriptConfiguration;
    code = tsTranspileModule(code, {
      compilerOptions: tsCompilerOptions,
      fileName: fsPath,
    }).outputText;
  }

  if (useSucrase) {
    try {
      code = sucraseTransform(code).code;
    } catch (e) {
      debug('Sucrase failed for entry, falling back to Babel', { error: e });
      const result = await babelTransformAsync(code);
      code = result?.code ?? code;
    }
  } else {
    const result = await babelTransformAsync(code);
    code = result?.code ?? code;
  }

  return { code, frontmatter };
}

// transform dependency file (MDX → TS → Babel/Sucrase, skip node_modules unless ESM)
async function transform(
  code: string,
  fsPath: string,
  preview: Preview
): Promise<string> {
  const extname = path.extname(fsPath);
  if (/\.mdx?$/i.test(extname)) {
    // for dependencies, we only need the code (frontmatter is ignored)
    const mdxResult = await mdxTranspileAsync(code, false, preview);
    code = mdxResult.code;
  }

  const useSucrase = preview.configuration.useSucraseTranspiler;
  if (/\.tsx?$/i.test(extname) && !useSucrase) {
    if (!preview.typescriptConfiguration) {
      preview.typescriptConfiguration = resolveTypescriptConfig(null);
    }
    const { tsCompilerOptions } = preview.typescriptConfiguration;
    code = tsTranspileModule(code, {
      compilerOptions: tsCompilerOptions,
      fileName: fsPath,
    }).outputText;
  }

  const isInNodeModules = fsPath.split(path.sep).includes('node_modules');
  if (!isInNodeModules || isModule(code)) {
    const transpilerChoice =
      isInNodeModules || useSucrase ? 'Sucrase' : 'Babel';
    debug(`Transpiling dependency: ${fsPath} (${transpilerChoice})`);
    if (isInNodeModules || useSucrase) {
      try {
        code = sucraseTransform(code).code;
      } catch (e) {
        debug('Sucrase failed for dependency, falling back to Babel', {
          file: fsPath,
          error: e,
        });
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
