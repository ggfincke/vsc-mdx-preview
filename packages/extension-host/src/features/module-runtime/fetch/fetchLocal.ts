// packages/extension-host/src/features/module-runtime/fetch/fetchLocal.ts
// browser-optimized module fetcher w/ ESM exports support & dependency resolution

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Preview } from '../../preview/preview-manager';
import { checkFsPathAsync } from '../security/checkFsPath';
import {
  PathAccessDeniedError,
  ErrorContext,
  createModuleNotFoundError,
} from '../../../shared/errors';
import { getErrorReporter, getFrameworkDetector } from '../../../app/services';
import { createTaggedLogger } from '../../../shared/logging/logger';
import { type FetchResult, LogTags } from '@mdx-preview/contracts';
import {
  MAX_MODULE_FILE_SIZE_BYTES,
  MAX_DEPENDENCIES_PER_MODULE,
  MODULE_FETCH_TIMEOUT_MS,
  IMAGE_EXTENSIONS,
} from '../../../shared/constants';

// import from extracted modules
import { getUnifiedResolver } from '../resolution/UnifiedResolver';
import { isIgnoredResolution } from '../resolution/resolution-builders';
import type { ResolutionContext } from '../../types';
import {
  normalizeNodePrefix,
  isCoreModule,
  buildNoopResult,
  NOOP_MODULE,
} from './utils';
import { handleByExtension, getScriptHandler } from '../handlers';
import { raceTimeout } from '../../../shared/utils/async-utils';
import { normalizePathSeparators } from '../../../shared/utils/path-utils';

// module-level tagged logger for module fetcher
const log = createTaggedLogger(LogTags.MODULE_SYSTEM);

export type { FetchResult } from '@mdx-preview/contracts';

// binary file magic bytes signatures
const BINARY_SIGNATURES: readonly number[][] = [
  // PNG
  [0x89, 0x50, 0x4e, 0x47],
  // JPEG
  [0xff, 0xd8, 0xff],
  // GIF
  [0x47, 0x49, 0x46],
  // PDF
  [0x25, 0x50, 0x44, 0x46],
  // ZIP/DOCX
  [0x50, 0x4b, 0x03, 0x04],
  // WEBP (RIFF header)
  [0x52, 0x49, 0x46, 0x46],
  // various binary formats (MP4, etc)
  [0x00, 0x00, 0x00],
];

// sniff binary signatures from the buffer used for source decoding
function isBinaryBuffer(buffer: Buffer): boolean {
  return BINARY_SIGNATURES.some((signature) =>
    signature.every((byte, index) => buffer[index] === byte)
  );
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

    // build resolution context for UnifiedResolver
    const frameworkDetector = getFrameworkDetector();
    const frameworkInfo = frameworkDetector.getFramework(preview.doc.uri);
    const shimsEnabled = frameworkDetector.areShimsEnabled(preview.doc.uri);
    const workspaceRoot =
      vscode.workspace.getWorkspaceFolder(preview.doc.uri)?.uri.fsPath ??
      entryFsDirectory;

    const resolutionContext: ResolutionContext = {
      baseDir: path.dirname(parentId),
      tsConfig: preview.typescriptConfiguration,
      framework: frameworkInfo.framework,
      workspaceRoot,
      shimsEnabled,
    };

    // use UnifiedResolver for all resolution (framework aliases, TypeScript, enhanced-resolve)
    const resolver = getUnifiedResolver();
    const resolution = await resolver.resolveAsync(
      request,
      resolutionContext,
      'browser'
    );

    if (!resolution) {
      throw createModuleNotFoundError(request, resolutionContext.baseDir);
    }

    if (isIgnoredResolution(resolution)) {
      log.debug(`Browser field ignored: ${request}`);
      return {
        fsPath: resolution.fsPath,
        code: NOOP_MODULE,
        dependencies: [],
      };
    }

    // if it's a built-in shim, return empty result (webview has this preloaded)
    if (resolution.isBuiltInShim) {
      log.debug(`Built-in shim: ${request} -> ${resolution.fsPath}`);
      return {
        fsPath: resolution.fsPath,
        code: '',
        dependencies: [],
      };
    }

    let fsPath = resolution.fsPath;

    if (!(await checkFsPathAsync(entryFsDirectory, fsPath))) {
      // fallback check for core modules that resolved to paths outside allowed directories
      if (isCoreModule(request)) {
        return buildNoopResult(normalizedRequest);
      }
      throw new PathAccessDeniedError(fsPath);
    }

    preview.dependentFsPaths.add(fsPath);

    // check file size before reading (prevents memory exhaustion)
    const stats = await fs.promises.stat(fsPath);
    if (stats.size > MAX_MODULE_FILE_SIZE_BYTES) {
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      const limitMB = (MAX_MODULE_FILE_SIZE_BYTES / 1024 / 1024).toFixed(0);
      throw new Error(
        `Module "${path.basename(fsPath)}" is ${sizeMB}MB, exceeds ${limitMB}MB limit`
      );
    }

    const extname = path.extname(fsPath).toLowerCase();
    if (path.sep === '\\') {
      // always return forward slash paths for resolution (https://github.com/xyc/vscode-mdx-preview/issues/13)
      fsPath = normalizePathSeparators(fsPath);
    }

    // image handlers only need the validated path to create a webview URI
    if ((IMAGE_EXTENSIONS as readonly string[]).includes(extname)) {
      const imageResult = await handleByExtension(
        '',
        fsPath,
        extname,
        preview
      );
      if (imageResult) {
        return imageResult;
      }
    }

    let code: string;
    // in onType mode, use in-memory document if available
    if (
      preview.configuration.updateMode === 'onType' &&
      preview.editingDoc &&
      preview.editingDoc.uri.fsPath === fsPath
    ) {
      code = preview.editingDoc.getText();
    } else {
      // read once, then sniff & decode the same bounded buffer
      const buffer = await raceTimeout(fs.promises.readFile(fsPath), {
        timeoutMs: MODULE_FETCH_TIMEOUT_MS,
        timeoutMessage:
          `Module fetch timed out after ${MODULE_FETCH_TIMEOUT_MS / 1000}s: ` +
          `${path.basename(fsPath)}`,
      });

      if (isBinaryBuffer(buffer)) {
        throw new Error(
          `Cannot import binary file "${path.basename(fsPath)}" (${extname}). ` +
            `Binary files like images should be referenced via URL or data URI.`
        );
      }
      code = buffer.toString('utf-8');
    }

    // dispatch to appropriate file type handler
    let result = await handleByExtension(code, fsPath, extname, preview);
    if (!result) {
      // fallback for unknown file types - treat as script
      result = await getScriptHandler().handle(code, fsPath, preview);
    }

    // check dependency count (prevents combinatorial explosion)
    if (result && result.dependencies.length > MAX_DEPENDENCIES_PER_MODULE) {
      log.warn(
        `Module ${path.basename(fsPath)} has ` +
          `${result.dependencies.length} dependencies, exceeding limit of ` +
          `${MAX_DEPENDENCIES_PER_MODULE}. Truncating.`
      );
      result.dependencies = result.dependencies.slice(
        0,
        MAX_DEPENDENCIES_PER_MODULE
      );
    }

    return result;
  } catch (error: unknown) {
    // report error via centralized ErrorReporter w/ helpful context
    getErrorReporter().report(error, {
      context: ErrorContext.ModuleFetch,
      showInWebview: true,
      webviewHandle: preview.webviewHandle,
      metadata: {
        request,
        parentId,
        hint: `Verify the path "${request}" exists & is accessible from "${parentId}".`,
      },
    });
    return undefined;
  }
}
