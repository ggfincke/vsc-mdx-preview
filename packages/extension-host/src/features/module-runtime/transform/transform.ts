// packages/extension/module-system/transform/transform.ts
// transpile entry & dependency files using MDX, TypeScript, Babel, or Sucrase

import { Preview } from '../../preview/preview-manager';
import * as path from 'path';
import isModule from 'is-module';
import { createLazyImport } from '../../../shared/utils/lazy-import';
import { transpileWithFallback } from './selector';
import { buildCompilerConfig } from '../../../shared/config/EffectivePreviewConfig';
import { debug } from '../../../shared/logging/logger';
import {
  transpileTypeScript,
  isTypeScriptExtension,
  isTypeScriptLanguage,
} from './typescript-transpile';
import type { CompilerConfig } from '../../types';

// lazy load Trusted Mode compiler - only loaded when Trusted Mode is actually used
const getCompileTrustedModule = createLazyImport(
  () => import('../../compilation/trusted/compile')
);

// re-export canonical type definitions from types/
export type { TransformEntryResult, TransformResult } from '../../types';

import type { TransformEntryResult, TransformResult } from '../../types';

// transform entry file (MDX → TS → Babel/Sucrase)
// I.1: return both esmCode (for import extraction) & code (for webview)
async function transformEntry(
  code: string,
  fsPath: string,
  preview: Preview,
  compilerConfig: CompilerConfig
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
    const mdxResult = await compileTrusted(code, true, compilerConfig);
    code = mdxResult.code;
    frontmatter = mdxResult.frontmatter;
  }

  const useSucrase = preview.configuration.useSucraseTranspiler;
  debug(`Transpiler: ${useSucrase ? 'Sucrase' : 'Babel'} selected for entry`);

  if (isTypeScriptLanguage(languageId) && !useSucrase) {
    code = transpileTypeScript(code, fsPath, preview);
  }

  // I.1: capture ESM code before CommonJS transformation
  const esmCode = code;

  code = await transpileWithFallback(code, {
    useSucrase,
    context: 'entry',
    filePath: fsPath,
  });

  return { code, esmCode, frontmatter };
}

// transform dependency file (MDX → TS → Babel/Sucrase, skip node_modules unless ESM)
// I.1: return both esmCode (for import extraction) & code (for webview)
async function transform(
  code: string,
  fsPath: string,
  preview: Preview
): Promise<TransformResult> {
  const extname = path.extname(fsPath);
  if (/\.mdx?$/i.test(extname)) {
    // for dependencies, we only need the code (frontmatter is ignored)
    const compilerConfig = buildCompilerConfig({
      docUri: preview.doc.uri,
      docFsPath: fsPath,
    });
    const { compileTrusted } = await getCompileTrustedModule();
    const mdxResult = await compileTrusted(code, false, compilerConfig);
    code = mdxResult.code;
  }

  const useSucrase = preview.configuration.useSucraseTranspiler;
  if (isTypeScriptExtension(extname) && !useSucrase) {
    code = transpileTypeScript(code, fsPath, preview);
  }

  // I.1: capture ESM code before CommonJS transformation
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
