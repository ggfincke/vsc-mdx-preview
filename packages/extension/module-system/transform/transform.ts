// packages/extension/module-system/transform/transform.ts
// transpile entry & dependency files using MDX, TypeScript, Babel, or Sucrase

import { Preview } from '../../preview/preview-manager';
import * as path from 'path';
import isModule from 'is-module';
import { createLazyImport } from '../../utils/lazy-import';
import { transpileWithFallback } from './selector';
import { debug } from '../../logging';
import {
  transpileTypeScript,
  isTypeScriptExtension,
  isTypeScriptLanguage,
} from './typescript-transpile';

// lazy load Trusted Mode compiler - only loaded when Trusted Mode is actually used
const getCompileTrustedModule = createLazyImport(
  () => import('../../compiler/trusted/compile')
);

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
    const { compileTrusted } = await getCompileTrustedModule();
    const mdxResult = await compileTrusted(code, true, preview);
    code = mdxResult.code;
    frontmatter = mdxResult.frontmatter;
  }

  const useSucrase = preview.configuration.useSucraseTranspiler;
  debug(`Transpiler: ${useSucrase ? 'Sucrase' : 'Babel'} selected for entry`);

  if (isTypeScriptLanguage(languageId) && !useSucrase) {
    code = transpileTypeScript(code, fsPath, preview);
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
    const { compileTrusted } = await getCompileTrustedModule();
    const mdxResult = await compileTrusted(code, false, preview);
    code = mdxResult.code;
  }

  const useSucrase = preview.configuration.useSucraseTranspiler;
  if (isTypeScriptExtension(extname) && !useSucrase) {
    code = transpileTypeScript(code, fsPath, preview);
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
