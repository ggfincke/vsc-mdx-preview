// packages/extension-host/src/features/module-runtime/transform/transform.ts
// transpile entry & dependency files using MDX, TypeScript, Babel, or Sucrase

import type { Preview } from '../../preview/preview-manager';
import * as path from 'path';
import isModule from 'is-module';
import { createLazyImport } from '../../../shared/utils/lazy-import';
import { transpileWithFallback } from './selector';
import {
  buildCompilerConfig,
  toMdxForgeCompilerConfig,
} from '../../preview/configuration/EffectivePreviewConfig';
import { createTaggedLogger } from '../../../shared/logging/logger';
import { LogTags } from '@mdx-preview/contracts';

const log = createTaggedLogger(LogTags.COMPILE);
import {
  transpileTypeScript,
  isTypeScriptExtension,
  isTypeScriptLanguage,
} from './typescript-transpile';
import type { CompilerConfig } from '../../../shared/config/types';
import type { ModuleExecutionContext } from '../types/handlers';
import { hasLiteralDynamicImport } from '../dependencies/import-extractor';

// lazy load Trusted Mode compiler - only loaded when Trusted Mode is actually used
const getCompileTrustedModule = createLazyImport(
  () => import('mdx-forge/compiler')
);

// re-export canonical type definitions from types/
export type { TransformEntryResult, TransformResult } from '../types/transpile';

import type { TransformEntryResult, TransformResult } from '../types/transpile';

// compile MDX via Trusted Mode (shared by entry & dependency transforms)
async function compileMdxTrusted(
  code: string,
  opts: { isEntry: boolean; compilerConfig: CompilerConfig }
): Promise<{ code: string; frontmatter: Record<string, unknown> }> {
  const { compileTrusted } = await getCompileTrustedModule();
  return compileTrusted(
    code,
    opts.isEntry,
    toMdxForgeCompilerConfig(opts.compilerConfig)
  );
}

// transform entry file (MDX -> TS -> Babel/Sucrase)
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
    const mdxResult = await compileMdxTrusted(code, {
      isEntry: true,
      compilerConfig,
    });
    code = mdxResult.code;
    frontmatter = mdxResult.frontmatter;
  }

  const useSucrase = preview.configuration.useSucraseTranspiler;
  log.debug(
    `Transpiler: ${useSucrase ? 'Sucrase' : 'Babel'} selected for entry`
  );

  if (isTypeScriptLanguage(languageId) && !useSucrase) {
    code = transpileTypeScript(code, fsPath);
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

// transform dependency file (MDX -> TS -> Babel/Sucrase, skip node_modules unless ESM)
// I.1: return both esmCode (for import extraction) & code (for webview)
async function transform(
  code: string,
  fsPath: string,
  context: ModuleExecutionContext
): Promise<TransformResult> {
  const extname = path.extname(fsPath).toLowerCase();
  if (/\.mdx?$/i.test(extname)) {
    // for dependencies, we only need the code (frontmatter is ignored)
    const compilerConfig = buildCompilerConfig({
      docUri: context.documentUri,
      docFsPath: fsPath,
    });
    const mdxResult = await compileMdxTrusted(code, {
      isEntry: false,
      compilerConfig,
    });
    code = mdxResult.code;
  }

  const useSucrase = context.useSucraseTranspiler;
  if (isTypeScriptExtension(extname) && !useSucrase) {
    code = transpileTypeScript(code, fsPath);
  }

  // I.1: capture ESM code before CommonJS transformation
  const esmCode = code;

  // split on both separators: callers may pass forward-slash-normalized paths on Windows
  const isInNodeModules = fsPath.split(/[\\/]/).includes('node_modules');
  const isEsm = isModule(code);
  const needsLiteralDynamicImportTransform =
    isInNodeModules && !isEsm && (await hasLiteralDynamicImport(code));
  if (!isInNodeModules || isEsm || needsLiteralDynamicImportTransform) {
    const preferSucrase = isInNodeModules || useSucrase;
    log.debug(
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
