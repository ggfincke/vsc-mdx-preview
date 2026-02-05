// packages/extension/module-system/handlers/SassHandler.ts
// handler for SASS/SCSS files - compiles to CSS using workspace's sass package

import * as path from 'path';
import type { FetchResult } from '@mdx-preview/shared';
import { extractErrorMessage, LogTags } from '@mdx-preview/shared';
import type { Preview } from '../../preview/preview-manager';
import type { FileTypeHandler } from './index';
import { getBrowserResolver } from '../resolver/resolver-factory';
import { buildCssResult } from './result-builders';
import { createTaggedLogger } from '../../logging';
import { SASS_EXTENSIONS } from '../../constants';
import {
  createKeyedLazyImport,
  loadModuleWithEsmFallback,
} from '../../utils/lazy-import';

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

// generate helpful CSS comment when sass is not available
function buildSassNotInstalledResult(fsPath: string): FetchResult {
  const fileName = path.basename(fsPath);
  const helpfulCss = `/* ════════════════════════════════════════════════════════════════════════════
   MDX Preview: SCSS/Sass Support Not Available
   ════════════════════════════════════════════════════════════════════════════

   The file "${fileName}" could not be compiled because the 'sass'
   package is not installed in your workspace.

   To enable SCSS/Sass support, run one of the following commands in your
   project directory:

     npm install -D sass
     # or
     yarn add -D sass
     # or
     pnpm add -D sass

   After installing, refresh the MDX preview (Cmd/Ctrl+Shift+P → "MDX: Refresh Preview")

   ════════════════════════════════════════════════════════════════════════════ */
`;
  return buildCssResult(fsPath, helpfulCss);
}

// handler for .scss & .sass files - compile SASS/SCSS to CSS using workspace's sass
export class SassHandler implements FileTypeHandler {
  extensions = [...SASS_EXTENSIONS];

  async handle(
    _code: string,
    fsPath: string,
    preview: Preview
  ): Promise<FetchResult> {
    const workspaceRoot = preview.entryFsDirectory;

    // if no workspace root, return helpful message
    if (!workspaceRoot) {
      log.debug('No workspace root available');
      return buildSassNotInstalledResult(fsPath);
    }

    // try to load sass from workspace
    const sass = await sassLoader.get(workspaceRoot);

    if (!sass) {
      // return CSS comment explaining how to enable SCSS support
      log.warn(
        `sass not installed in workspace, returning help message for ${fsPath}`
      );
      return buildSassNotInstalledResult(fsPath);
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
              return new URL(`file://${resolved}`);
            },
          },
        ],
      });

      return buildCssResult(fsPath, result.css);
    } catch (error: unknown) {
      // sass compilation error - return error as CSS comment for visibility
      const errorMessage = extractErrorMessage(error);
      const errorCss = `/* ════════════════════════════════════════════════════════════════════════════
   MDX Preview: SCSS Compilation Error
   ════════════════════════════════════════════════════════════════════════════

   File: ${path.basename(fsPath)}

   Error:
${errorMessage
  .split('\n')
  .map((line) => '   ' + line)
  .join('\n')}

   ════════════════════════════════════════════════════════════════════════════ */
`;
      log.warn(
        `Compilation error for ${fsPath}: ${errorMessage}`
      );
      return buildCssResult(fsPath, errorCss);
    }
  }
}
