// packages/extension/module-system/transform/transform.ts
// transpile entry & dependency files using MDX, TypeScript, Babel, or Sucrase

import { Preview } from '../../preview/preview-manager';
import * as path from 'path';
import isModule from 'is-module';
import { compileTrusted } from '../../compiler/trusted/compile';
import { transpileModule as tsTranspileModule } from 'typescript';
import { transpileWithFallback } from './selector';
import { debug } from '../../logging';
import { resolveTypescriptConfig } from '../../preview/config';

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
    const mdxResult = await compileTrusted(code, true, preview);
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

  code = await transpileWithFallback(code, {
    useSucrase,
    context: 'entry',
    filePath: fsPath,
  });

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
    const mdxResult = await compileTrusted(code, false, preview);
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
    const preferSucrase = isInNodeModules || useSucrase;
    debug(
      `Transpiling dependency: ${fsPath} (${preferSucrase ? 'Sucrase' : 'Babel'})`
    );
    code = await transpileWithFallback(code, {
      useSucrase: preferSucrase,
      context: 'dependency',
      filePath: fsPath,
    });
  }

  return code;
}

export { transformEntry, transform };
