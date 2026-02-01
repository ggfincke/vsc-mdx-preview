// packages/extension/module-system/handlers/SassHandler.ts
// handler for SASS/SCSS files - compiles to CSS using workspace's sass package

import * as path from 'path';
import { pathToFileURL } from 'url';
import type { FetchResult } from '@mdx-preview/shared';
import { extractErrorMessage, LogTags } from '@mdx-preview/shared';
import type { Preview } from '../../preview/preview-manager';
import type { FileTypeHandler } from './index';
import { getBrowserResolver } from '../resolver/resolver-factory';
import { buildCssResult } from './result-builders';
import { debug, warn } from '../../logging';
import { SASS_EXTENSIONS } from '../../constants';

// type-only import for sass module (doesn't bundle the implementation)
type SassModule = typeof import('sass');
type CompileResult = import('sass').CompileResult;

// module-level cache for loaded sass instance
// keyed by workspace root to support multi-root workspaces
const sassCache = new Map<string, SassModule | null>();

// load sass from workspace's node_modules
// return null if sass not installed (w/ caching to avoid repeated lookups)
async function loadSassFromWorkspace(
  workspaceRoot: string
): Promise<SassModule | null> {
  // check cache first
  if (sassCache.has(workspaceRoot)) {
    return sassCache.get(workspaceRoot)!;
  }

  const sassPath = path.join(workspaceRoot, 'node_modules', 'sass');

  try {
    // try CommonJS require first (most common case)

    const mod = require(sassPath);
    const sassModule = (mod.default ?? mod) as SassModule;

    // validate it has the expected API
    if (typeof sassModule.compileAsync !== 'function') {
      warn(
        `[${LogTags.SASS_HANDLER}] sass at ${sassPath} missing compileAsync method`
      );
      sassCache.set(workspaceRoot, null);
      return null;
    }

    debug(`[${LogTags.SASS_HANDLER}] Loaded sass from workspace: ${sassPath}`);
    sassCache.set(workspaceRoot, sassModule);
    return sassModule;
  } catch (error) {
    // handle ESM-only sass package
    const isEsm =
      error instanceof Error &&
      'code' in error &&
      (error as NodeJS.ErrnoException).code === 'ERR_REQUIRE_ESM';

    if (isEsm) {
      try {
        const specifier = pathToFileURL(sassPath).href;
        const mod = await import(specifier);
        const sassModule = ((mod as { default?: unknown }).default ??
          mod) as SassModule;

        if (typeof sassModule.compileAsync !== 'function') {
          warn(
            `[${LogTags.SASS_HANDLER}] ESM sass at ${sassPath} missing compileAsync`
          );
          sassCache.set(workspaceRoot, null);
          return null;
        }

        debug(
          `[${LogTags.SASS_HANDLER}] Loaded ESM sass from workspace: ${sassPath}`
        );
        sassCache.set(workspaceRoot, sassModule);
        return sassModule;
      } catch (esmError) {
        debug(
          `[${LogTags.SASS_HANDLER}] Failed to load ESM sass: ${extractErrorMessage(esmError)}`
        );
      }
    }

    // sass not found or load error
    debug(
      `[${LogTags.SASS_HANDLER}] sass not found in workspace: ${extractErrorMessage(error)}`
    );
    sassCache.set(workspaceRoot, null);
    return null;
  }
}

// clear cached sass modules (call when workspace changes or on refresh)
export function clearSassCache(): void {
  sassCache.clear();
  debug(`[${LogTags.SASS_HANDLER}] Sass cache cleared`);
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

// handler for .scss & .sass files - compiles SASS/SCSS to CSS using workspace's sass
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
      debug(`[${LogTags.SASS_HANDLER}] No workspace root available`);
      return buildSassNotInstalledResult(fsPath);
    }

    // try to load sass from workspace
    const sass = await loadSassFromWorkspace(workspaceRoot);

    if (!sass) {
      // return CSS comment explaining how to enable SCSS support
      warn(
        `[${LogTags.SASS_HANDLER}] sass not installed in workspace, returning help message for ${fsPath}`
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
    } catch (error) {
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
      warn(
        `[${LogTags.SASS_HANDLER}] Compilation error for ${fsPath}: ${errorMessage}`
      );
      return buildCssResult(fsPath, errorCss);
    }
  }
}
