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
  // I.1: ESM code before CommonJS conversion (for import extraction)
  esmCode: string;
  frontmatter: Record<string, unknown>;
}

// I.1: result type for dependency transformation
// return both ESM (for import extraction) & CJS (for webview evaluation)
export interface TransformResult {
  // final CommonJS for webview evaluation
  code: string;
  // ESM code before CommonJS conversion
  esmCode: string;
}

// transform entry file (MDX → TS → Babel/Sucrase)
// I.1: returns both esmCode (for import extraction) & code (for webview)
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

  // I.1: Capture ESM code before CommonJS transformation
  const esmCode = code;

  code = await transpileWithFallback(code, {
    useSucrase,
    context: 'entry',
    filePath: fsPath,
  });

  return { code, esmCode, frontmatter };
}

// transform dependency file (MDX → TS → Babel/Sucrase, skip node_modules unless ESM)
// I.1: returns both esmCode (for import extraction) & code (for webview)
async function transform(
  code: string,
  fsPath: string,
  preview: Preview
): Promise<TransformResult> {
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

  // I.1: Capture ESM code before CommonJS transformation
  const esmCode = code;

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

  return { code, esmCode };
}

export { transformEntry, transform };
