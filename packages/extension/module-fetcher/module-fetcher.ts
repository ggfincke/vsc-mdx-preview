// packages/extension/module-fetcher/module-fetcher.ts
// browser-optimized module fetcher w/ ESM exports support & dependency resolution

import * as fs from 'fs';
import * as path from 'path';
import * as typescript from 'typescript';
import { Preview } from '../preview/preview-manager';
import { checkFsPath } from '../security/checkFsPath';
import {
  ExtensionError,
  ModuleFetchError,
  PathAccessDeniedError,
} from '../errors';
import { formatUserError, formatLogError } from '../errors/messages';
import { error as logError, debug } from '../logging';
import type { FetchResult } from '@mdx-preview/shared-types';
import { FrameworkDetector, resolveAlias, isBuiltInShim } from '../framework';

// import from extracted modules
import { getBrowserResolver } from './resolver-factory';
import {
  normalizeNodePrefix,
  isCoreModule,
  buildNoopResult,
  NOOP_MODULE,
} from './utils';
import { handleByExtension } from './handlers';

export type { FetchResult } from '@mdx-preview/shared-types';

// get shared browser resolver instance
const browserResolver = getBrowserResolver();

// resolve module using enhanced-resolve w/ browser-aware resolution
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
      return buildNoopResult(normalizedRequest);
    }

    // check for framework-specific import aliases (e.g., @theme/Tabs, @astrojs/starlight/components)
    const frameworkDetector = FrameworkDetector.getInstance();
    const frameworkInfo = frameworkDetector.getFramework(preview.doc.uri);
    const workspaceRoot = preview.entryFsDirectory;

    if (isBare && frameworkDetector.areShimsEnabled(preview.doc.uri)) {
      const aliasedPath = resolveAlias(
        request,
        frameworkInfo.framework,
        workspaceRoot
      );

      if (aliasedPath !== null) {
        // if it's a built-in shim, return a special result that webview will handle
        if (isBuiltInShim(aliasedPath)) {
          debug(
            `[MODULE-FETCHER] Resolved framework alias: ${request} -> ${aliasedPath}`
          );
          // return empty result - webview has this preloaded
          // empty code - webview module loader handles this via preloaded aliases
          return {
            fsPath: aliasedPath,
            code: '',
            dependencies: [],
          };
        }

        // otherwise, resolve the aliased path (e.g., @site/components -> workspace path)
        debug(
          `[MODULE-FETCHER] Resolved path alias: ${request} -> ${aliasedPath}`
        );
        request = aliasedPath;
      }
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
        return buildNoopResult(normalizedRequest);
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

    // dispatch to appropriate file type handler
    const result = await handleByExtension(code, fsPath, extname, preview);
    if (result) {
      return result;
    }

    // fallback for unknown file types - treat as script
    const { ScriptHandler } = await import('./handlers/ScriptHandler');
    const scriptHandler = new ScriptHandler();
    return scriptHandler.handle(code, fsPath, preview);
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
