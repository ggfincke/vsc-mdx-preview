// packages/extension/module-fetcher/module-fetcher.ts
// browser-optimized module fetcher w/ ESM exports support & dependency resolution

import * as fs from 'fs';
import * as path from 'path';
import { Preview } from '../preview/preview-manager';
import { checkFsPath } from '../security/checkFsPath';
import {
  ModuleFetchError,
  PathAccessDeniedError,
  ErrorContext,
} from '../errors';
import { getErrorReporter, getFrameworkDetector } from '../services';
import { debug } from '../logging';
import type { FetchResult } from '@mdx-preview/shared-types';

// import from extracted modules
import { getUnifiedResolver, type ResolutionContext } from './UnifiedResolver';
import {
  normalizeNodePrefix,
  isCoreModule,
  buildNoopResult,
  NOOP_MODULE,
} from './utils';
import { handleByExtension } from './handlers';

export type { FetchResult } from '@mdx-preview/shared-types';

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

    // build resolution context for UnifiedResolver
    const frameworkDetector = getFrameworkDetector();
    const frameworkInfo = frameworkDetector.getFramework(preview.doc.uri);
    const shimsEnabled = frameworkDetector.areShimsEnabled(preview.doc.uri);

    const resolutionContext: ResolutionContext = {
      baseDir: path.dirname(parentId),
      tsConfig: preview.typescriptConfiguration,
      framework: frameworkInfo.framework,
      workspaceRoot: entryFsDirectory,
      shimsEnabled,
    };

    // use UnifiedResolver for all resolution (framework aliases, TypeScript, enhanced-resolve)
    const resolver = getUnifiedResolver();
    const resolution = resolver.resolveSync(
      request,
      resolutionContext,
      'browser'
    );

    if (!resolution) {
      throw new ModuleFetchError(
        `Cannot resolve module: ${request} from ${resolutionContext.baseDir}`,
        'MODULE_NOT_FOUND',
        request,
        resolutionContext.baseDir
      );
    }

    // if it's a built-in shim, return empty result (webview has this preloaded)
    if (resolution.isBuiltInShim) {
      debug(
        `[MODULE-FETCHER] Built-in shim: ${request} -> ${resolution.fsPath}`
      );
      return {
        fsPath: resolution.fsPath,
        code: '',
        dependencies: [],
      };
    }

    let fsPath = resolution.fsPath;

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
    // report error via centralized ErrorReporter
    getErrorReporter().report(error, {
      context: ErrorContext.ModuleFetch,
      showInWebview: true,
      webviewHandle: preview.webviewHandle,
      metadata: { request, parentId },
    });
    return undefined;
  }
}
