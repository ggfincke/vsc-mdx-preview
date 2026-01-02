import * as fs from 'fs';
import * as path from 'path';
import * as typescript from 'typescript';
import * as sass from 'sass';
import resolve from 'resolve';
import { init as initLexer, parse as parseImports } from 'es-module-lexer';
import { Preview } from '../preview/preview-manager';
import { transform } from './transform';
import { checkFsPath, PathAccessDeniedError } from '../security/checkFsPath';
import { error as logError } from '../logging';

// Initialize es-module-lexer once at module load
let lexerInitialized = false;
async function ensureLexerInitialized(): Promise<void> {
  if (!lexerInitialized) {
    await initLexer;
    lexerInitialized = true;
  }
}

/**
 * Result of fetching a module.
 */
export interface FetchResult {
  fsPath: string;
  code: string;
  dependencies: string[];
  css?: string;
}

const NOOP_MODULE = `Object.defineProperty(exports, '__esModule', { value: true });
  function noop() {}
  exports.default = noop;`;

// https://github.com/calvinmetcalf/rollup-plugin-node-builtins
// License: MIT except ES6 ports of browserify modules which are whatever the original library was.
const NODE_CORE_MODULES = new Set([
  // unshimmable
  'dns',
  'dgram',
  'child_process',
  'cluster',
  'module',
  'net',
  'readline',
  'repl',
  'tls',

  'crypto',
]);

const SHIMMABLE_NODE_CORE_MODULES = new Set([
  'process',
  'events',
  'util',
  'os',
  'fs',
  'path',
  'buffer',
  'url',
  'string_decoder',
  'punycode',
  'querystring',
  'stream',
  'http',
  'https',
  'assert',
  'constants',
  'timers',
  'console',
  'vm',
  'zlib',
  'tty',
  'domain',
]);

/**
 * Resolve a module using the modern `resolve` package.
 * Supports package.json "exports" field for ESM-first resolution.
 *
 * @param request - The module request (e.g., 'lodash', './utils', '../foo')
 * @param basedir - The directory to resolve from
 * @returns The resolved file path
 */
function resolveModule(request: string, basedir: string): string {
  return resolve.sync(request, {
    basedir,
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json'],
    // Support package.json exports
    packageFilter: (pkg) => {
      // Prefer browser field when present (webview runtime)
      if (typeof pkg.browser === 'string') {
        pkg.main = pkg.browser;
        return pkg;
      }

      // Prefer module field for ESM when present
      if (pkg.module) {
        pkg.main = pkg.module;
      }
      return pkg;
    },
  });
}

/**
 * Extract imports from code using es-module-lexer.
 * ESM-first approach - handles both static and dynamic imports.
 *
 * @param code - The code to parse
 * @returns Array of import specifiers
 */
async function extractImports(code: string): Promise<string[]> {
  await ensureLexerInitialized();

  try {
    const [imports] = parseImports(code);
    return imports
      .map((imp) => imp.n)
      .filter((name): name is string => name !== undefined && name !== null);
  } catch (error) {
    // Fallback for code that can't be parsed (e.g., CJS)
    // Try to extract require() calls with a simple regex
    const requireMatches = code.matchAll(
      /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
    );
    return Array.from(requireMatches, (m) => m[1]);
  }
}

export async function fetchLocal(
  request: string,
  isBare: boolean,
  parentId: string,
  preview: Preview
): Promise<FetchResult | undefined> {
  try {
    const entryFsDirectory = preview.entryFsDirectory;
    if (!entryFsDirectory) {
      return {
        fsPath: '/noop',
        code: NOOP_MODULE,
        dependencies: [],
      };
    }

    if (isBare && NODE_CORE_MODULES.has(request)) {
      return {
        fsPath: `/externalModules/${request}`,
        code: NOOP_MODULE,
        dependencies: [],
      };
    }

    let fsPath: string | null = null;

    // Try TypeScript resolution first (if available and not in node_modules)
    if (
      preview.typescriptConfiguration &&
      !parentId.split(path.sep).includes('node_modules')
    ) {
      const { tsCompilerOptions, tsCompilerHost } =
        preview.typescriptConfiguration;
      const resolvedModule = typescript.resolveModuleName(
        request,
        parentId,
        tsCompilerOptions,
        tsCompilerHost
      ).resolvedModule;
      if (resolvedModule) {
        fsPath = resolvedModule.resolvedFileName;
        // don't resolve .d.ts file with tsCompilerHost
        if (fsPath.endsWith('.d.ts')) {
          fsPath = null;
        }
      }
    }

    // Fallback to modern resolver with ESM exports support
    if (!fsPath) {
      const basedir = path.dirname(parentId);
      fsPath = resolveModule(request, basedir);
    }

    if (!checkFsPath(entryFsDirectory, fsPath)) {
      if (SHIMMABLE_NODE_CORE_MODULES.has(request)) {
        return {
          fsPath: `/externalModules/${request}`,
          code: NOOP_MODULE,
          dependencies: [],
        };
      }
      throw new PathAccessDeniedError(fsPath);
    }

    preview.dependentFsPaths.add(fsPath);

    let code: string;
    if (
      preview.configuration.previewOnChange &&
      preview.editingDoc &&
      preview.editingDoc.uri.fsPath === fsPath
    ) {
      code = preview.editingDoc.getText();
    } else {
      // ASYNC: Use fs.promises.readFile
      code = await fs.promises.readFile(fsPath, 'utf-8');
    }

    const extname = path.extname(fsPath);
    if (path.sep === '\\') {
      // Always return forward slash paths for resolution
      // https://github.com/xyc/vscode-mdx-preview/issues/13
      fsPath = fsPath.replace(/\\/g, '/');
    }
    if (/\.json$/i.test(extname)) {
      return {
        fsPath,
        code: `module.exports = ${code}`,
        dependencies: [],
      };
    }
    if (/\.css$/i.test(extname)) {
      return {
        fsPath,
        css: code,
        code: '',
        dependencies: [],
      };
    }
    if (/\.(scss|sass)$/i.test(extname)) {
      // ASYNC: Use sass.compileAsync
      const result = await sass.compileAsync(fsPath, {
        importers: [
          {
            findFileUrl: (url: string) => {
              const resolved = resolveModule(url, path.dirname(fsPath!));
              return new URL(`file://${resolved}`);
            },
          },
        ],
      });
      return {
        fsPath,
        css: result.css,
        code: '',
        dependencies: [],
      };
    }
    if (/\.(gif|png|jpe?g|svg)$/i.test(extname)) {
      const webviewUri = preview.getWebviewUri(fsPath);
      if (!webviewUri) {
        throw new Error(
          `Preview webview not initialized; cannot create webview URI for local image: ${fsPath}`
        );
      }
      const code = `module.exports = "${webviewUri}"`;
      return {
        fsPath,
        code,
        dependencies: [],
      };
    }

    code = await transform(code, fsPath, preview);

    // Extract imports using es-module-lexer (ESM-first)
    const importNames = await extractImports(code);
    const dependencies = importNames
      .map((dependencyName) => {
        if (!dependencyName) {
          return undefined;
        }
        return dependencyName;
      })
      .filter((dep): dep is string => dep !== undefined);

    return {
      fsPath,
      code,
      dependencies,
    };
  } catch (error) {
    logError('Module fetch failed', { request, error });
    const message = error instanceof Error ? error.message : String(error);
    preview.webviewHandle.showPreviewError({ message });
  }
}
