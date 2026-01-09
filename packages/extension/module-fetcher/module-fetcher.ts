// packages/extension/module-fetcher/module-fetcher.ts
// browser-optimized module fetcher w/ ESM exports support & dependency resolution

import * as fs from 'fs';
import * as path from 'path';
import * as typescript from 'typescript';
import * as sass from 'sass';
import { CachedInputFileSystem, ResolverFactory } from 'enhanced-resolve';
import type { Resolver } from 'enhanced-resolve';
import { init as initLexer, parse as parseImports } from 'es-module-lexer';
import { Preview } from '../preview/preview-manager';
import { transform } from './transform';
import { checkFsPath } from '../security/checkFsPath';
import {
  ExtensionError,
  ModuleFetchError,
  PathAccessDeniedError,
} from '../errors';
import { formatUserError, formatLogError } from '../errors/messages';
import { error as logError } from '../logging';
import type { FetchResult } from '@mdx-preview/shared-types';

export type { FetchResult } from '@mdx-preview/shared-types';

// initialize es-module-lexer once at module load
let lexerInitialized = false;
async function ensureLexerInitialized(): Promise<void> {
  if (!lexerInitialized) {
    await initLexer;
    lexerInitialized = true;
  }
}

const NOOP_MODULE = `Object.defineProperty(exports, '__esModule', { value: true });
  function noop() {}
  exports.default = noop;`;

// https://github.com/calvinmetcalf/rollup-plugin-node-builtins
// License: MIT except ES6 ports of browserify modules which are whatever the original library was.

// Node.js core modules that cannot be shimmed in a browser environment (return noop module)
const UNSHIMMABLE_CORE_MODULES = new Set([
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

// Node.js core modules that could theoretically be shimmed but return noop for security/simplicity in webview context
const SHIMMABLE_CORE_MODULES = new Set([
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

// combined set of all Node.js core modules for quick lookup
const ALL_CORE_MODULES = new Set([
  ...UNSHIMMABLE_CORE_MODULES,
  ...SHIMMABLE_CORE_MODULES,
]);

// normalize module request by stripping `node:` prefix if present (e.g., 'node:fs' -> 'fs')
function normalizeNodePrefix(request: string): string {
  return request.startsWith('node:') ? request.slice(5) : request;
}

// check if module request is for Node.js core module (handles both `node:fs` & `fs` forms)
function isCoreModule(request: string): boolean {
  const normalized = normalizeNodePrefix(request);
  return ALL_CORE_MODULES.has(normalized);
}

// create browser-optimized module resolver using enhanced-resolve w/ exports field & browser condition support
const cachedFs = new CachedInputFileSystem(fs, 4000);
const browserResolver: Resolver = ResolverFactory.createResolver({
  fileSystem: cachedFs,
  extensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json'],
  // condition names for exports field resolution (priority: browser > import > require > default)
  conditionNames: ['browser', 'import', 'require', 'default'],
  // main field priority: browser > module > main
  mainFields: ['browser', 'module', 'main'],
  // enable exports/imports field processing
  exportsFields: ['exports'],
  importsFields: ['imports'],
  // support browser field aliasing (e.g., {"./node.js": "./browser.js", "fs": false})
  aliasFields: ['browser'],
  modules: ['node_modules'],
  mainFiles: ['index'],
  symlinks: true,
  useSyncFileSystemCalls: true,
});

// resolve module using enhanced-resolve w/ browser-aware resolution (exports field, browser conditions, & browser field aliasing)
function resolveModule(request: string, basedir: string): string {
  const resolved = browserResolver.resolveSync({}, basedir, request);
  if (resolved === false || resolved === undefined) {
    throw new ModuleFetchError(
      `Cannot resolve module: ${request} from ${basedir}`,
      'MODULE_NOT_FOUND',
      request,
      basedir
    );
  }
  return resolved;
}

// extract imports from code using es-module-lexer (ESM-first, handles static & dynamic imports)
async function extractImports(code: string): Promise<string[]> {
  await ensureLexerInitialized();

  try {
    const [imports] = parseImports(code);
    return imports
      .map((imp) => imp.n)
      .filter((name): name is string => name !== undefined && name !== null);
  } catch {
    // fallback for code that can't be parsed (e.g., CJS) - extract require() calls w/ regex
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

    // check for Node.js core modules early (handles both `fs` & `node:fs` forms)
    const normalizedRequest = normalizeNodePrefix(request);
    if (isBare && isCoreModule(request)) {
      return {
        fsPath: `/externalModules/${normalizedRequest}`,
        code: NOOP_MODULE,
        dependencies: [],
      };
    }

    let fsPath: string | null = null;

    // try TypeScript resolution first (if available & not in node_modules)
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
        // don't resolve .d.ts file w/ tsCompilerHost
        if (fsPath.endsWith('.d.ts')) {
          fsPath = null;
        }
      }
    }

    // fallback to modern resolver w/ ESM exports support
    if (!fsPath) {
      const basedir = path.dirname(parentId);
      fsPath = resolveModule(request, basedir);
    }

    if (!checkFsPath(entryFsDirectory, fsPath)) {
      // fallback check for core modules that resolved to paths outside allowed directories
      if (isCoreModule(request)) {
        return {
          fsPath: `/externalModules/${normalizedRequest}`,
          code: NOOP_MODULE,
          dependencies: [],
        };
      }
      throw new PathAccessDeniedError(fsPath);
    }

    preview.dependentFsPaths.add(fsPath);

    let code: string;
    // in onType mode, use in-memory document if available
    if (
      preview.configuration.updateMode === 'onType' &&
      preview.editingDoc &&
      preview.editingDoc.uri.fsPath === fsPath
    ) {
      code = preview.editingDoc.getText();
    } else {
      // use async fs.promises.readFile
      code = await fs.promises.readFile(fsPath, 'utf-8');
    }

    const extname = path.extname(fsPath);
    if (path.sep === '\\') {
      // always return forward slash paths for resolution (https://github.com/xyc/vscode-mdx-preview/issues/13)
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
      // use async sass.compileAsync
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
        throw new ModuleFetchError(
          `Preview webview not initialized; cannot create webview URI for: ${fsPath}`,
          'TRANSFORM_ERROR',
          fsPath
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

    // extract imports using es-module-lexer (ESM-first)
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
    // handle all structured errors (ModuleFetchError, SecurityError, TranspileError)
    if (error instanceof ExtensionError) {
      logError('Module fetch failed', formatLogError(error));
      preview.webviewHandle.showPreviewError({
        message: formatUserError(error),
        code: error.code,
      });
    } else {
      const message = error instanceof Error ? error.message : String(error);
      logError('Module fetch failed', { request, error: message });
      preview.webviewHandle.showPreviewError({ message });
    }
    return undefined;
  }
}
