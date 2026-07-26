// packages/extension-host/src/features/module-runtime/handlers/SassHandler.ts
// handler for SASS/SCSS files - compile to CSS using workspace's sass package

import * as path from 'path';
import * as vscode from 'vscode';
import { pathToFileURL } from 'url';
import type { FetchResult } from '@mdx-preview/contracts';
import { LogTags } from '@mdx-preview/contracts';
import { extractErrorMessage } from '@mdx-preview/runtime-utils';
import type { Preview } from '../../preview/preview-manager';
import type { FileTypeHandler } from './index';
import { getBrowserResolver } from '../resolution/resolver-factory';
import { buildCssResult } from './result-builders';
import { createTaggedLogger } from '../../../shared/logging/logger';
import { SASS_EXTENSIONS } from '../../../shared/constants';
import {
  createKeyedLazyImport,
  loadModuleWithEsmFallback,
} from '../../../shared/utils/lazy-import';

// module-level tagged logger for SASS handler
const log = createTaggedLogger(LogTags.SASS_HANDLER);

// type-only import for sass module (doesn't bundle the implementation)
type SassModule = typeof import('sass');
type CompileResult = import('sass').CompileResult;

// keyed lazy import for sass module (per workspace root)
const sassLoader = createKeyedLazyImport<SassModule>({
  async loadFn(workspaceRoot: string) {
    const sassPath = path.join(workspaceRoot, 'node_modules', 'sass');
    return loadModuleWithEsmFallback<SassModule>(sassPath);
  },

  validate(mod) {
    return typeof mod.compileAsync === 'function';
  },

  onValidationFailed(key) {
    const sassPath = path.join(key, 'node_modules', 'sass');
    log.warn(`sass at ${sassPath} missing compileAsync`);
  },

  onLoaded(key) {
    const sassPath = path.join(key, 'node_modules', 'sass');
    log.debug(`Loaded sass from workspace: ${sassPath}`);
  },

  onLoadFailed(key, error) {
    log.debug(
      `sass not found in workspace ${key}: ${extractErrorMessage(error)}`
    );
  },
});

// clear cached sass modules (call when workspace changes or on refresh)
export function clearSassCache(): void {
  sassLoader.clear();
  log.debug('Sass cache cleared');
}

// boxed-comment border (length must stay exact)
const SASS_COMMENT_BORDER =
  '════════════════════════════════════════════════════════════════════════════';

// build a boxed CSS comment w/ title & precomputed body
function buildSassCssComment(title: string, body: string): string {
  return `/* ${SASS_COMMENT_BORDER}
   ${title}
   ${SASS_COMMENT_BORDER}

${body}

   ${SASS_COMMENT_BORDER} */
`;
}

// generate helpful CSS comment when sass is not available
function buildSassNotInstalledResult(
  fsPath: string,
  preview: Preview
): FetchResult {
  const fileName = path.basename(fsPath);
  const body = `   The file "${fileName}" could not be compiled because the 'sass'
   package is not installed in your workspace.

   To enable SCSS/Sass support, run one of the following commands in your
   project directory:

     npm install -D sass
     # or
     yarn add -D sass
     # or
     pnpm add -D sass

   After installing, refresh the MDX preview (Cmd/Ctrl+Shift+P -> "MDX: Refresh Preview")`;
  const helpfulCss = buildSassCssComment(
    'MDX Preview: SCSS/Sass Support Not Available',
    body
  );
  return buildCssResult(fsPath, helpfulCss, preview);
}

// handler for .scss & .sass files - compile SASS/SCSS to CSS using workspace's sass
export class SassHandler implements FileTypeHandler {
  extensions = [...SASS_EXTENSIONS];

  async handle(
    _code: string,
    fsPath: string,
    preview: Preview
  ): Promise<FetchResult> {
    const workspaceRoot =
      (preview.doc
        ? vscode.workspace.getWorkspaceFolder(preview.doc.uri)?.uri.fsPath
        : undefined) ??
      preview.entryFsDirectory;

    // if no workspace root, return helpful message
    if (!workspaceRoot) {
      log.debug('No workspace root available');
      return buildSassNotInstalledResult(fsPath, preview);
    }

    // try to load sass from workspace
    const sass = await sassLoader.get(workspaceRoot);

    if (!sass) {
      // return CSS comment explaining how to enable SCSS support
      log.warn(
        `sass not installed in workspace, returning help message for ${fsPath}`
      );
      return buildSassNotInstalledResult(fsPath, preview);
    }

    // compile SCSS using workspace's sass
    try {
      const browserResolver = getBrowserResolver();

      const result: CompileResult = await sass.compileAsync(fsPath, {
        importers: [
          {
            findFileUrl: (url: string) => {
              const resolved = browserResolver.resolveSync(
                {},
                path.dirname(fsPath),
                url
              );
              if (resolved === false || resolved === undefined) {
                return null;
              }
              // pathToFileURL handles Windows drive letters & special chars
              return pathToFileURL(resolved);
            },
          },
        ],
      });

      return buildCssResult(fsPath, result.css, preview);
    } catch (error: unknown) {
      // sass compilation error - return error as CSS comment for visibility
      const errorMessage = extractErrorMessage(error);
      const indentedError = errorMessage
        .split('\n')
        .map((line) => '   ' + line)
        .join('\n');
      const body = `   File: ${path.basename(fsPath)}

   Error:
${indentedError}`;
      const errorCss = buildSassCssComment(
        'MDX Preview: SCSS Compilation Error',
        body
      );
      log.warn(`Compilation error for ${fsPath}: ${errorMessage}`);
      return buildCssResult(fsPath, errorCss, preview);
    }
  }
}
