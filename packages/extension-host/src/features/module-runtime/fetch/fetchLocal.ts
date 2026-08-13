// packages/extension-host/src/features/module-runtime/fetch/fetchLocal.ts
// browser-optimized module fetcher w/ ESM exports support & dependency resolution

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { Preview } from '../../preview/preview-manager';
import { checkFsPathAsync } from '../security/checkFsPath';
import {
  PathAccessDeniedError,
  ErrorContext,
  createModuleNotFoundError,
} from '../../../shared/errors';
import { getErrorReporter } from '../../../app/services';
import { createTaggedLogger } from '../../../shared/logging/logger';
import {
  type FetchResult,
  LogTags,
  type ModuleDependencyKind,
} from '@mdx-preview/contracts';
import {
  MAX_MODULE_FILE_SIZE_BYTES,
  MAX_DEPENDENCIES_PER_MODULE,
  MODULE_FETCH_TIMEOUT_MS,
  IMAGE_EXTENSIONS,
} from '../../../shared/constants';

// import from extracted modules
import { getUnifiedResolver } from '../resolution/UnifiedResolver';
import { isIgnoredResolution } from '../resolution/resolution-builders';
import { buildResolutionContext } from '../resolution/resolution-context';
import type {
  FileTypeHandlerResult,
  ModuleExecutionContext,
} from '../types/handlers';
import {
  normalizeNodePrefix,
  isCoreModule,
  buildNoopResult,
  NOOP_MODULE,
} from './utils';
import { handleByExtension, getScriptHandler } from '../handlers';
import { raceTimeout } from '../../../shared/utils/async-utils';
import {
  normalizePathForComparison,
  normalizePathSeparators,
} from '../../../shared/utils/path-utils';

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

// reject source buffers before allocation crosses the module limit
function enforceModuleSize(fsPath: string, size: number): void {
  if (size <= MAX_MODULE_FILE_SIZE_BYTES) {
    return;
  }

  const sizeMB = (size / 1024 / 1024).toFixed(2);
  const limitMB = (MAX_MODULE_FILE_SIZE_BYTES / 1024 / 1024).toFixed(0);
  throw new Error(
    `Module "${path.basename(fsPath)}" is ${sizeMB}MB, exceeds ${limitMB}MB limit`
  );
}

// open once, validate size from the handle, & read at most the observed size
async function readModuleFile(
  fsPath: string,
  includeContents: boolean
): Promise<Buffer | null> {
  const fileHandle = await fs.promises.open(fsPath, 'r');
  try {
    const stats = await fileHandle.stat();
    enforceModuleSize(fsPath, stats.size);
    if (!includeContents) {
      return null;
    }

    const buffer = Buffer.alloc(stats.size);
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await fileHandle.read(
        buffer,
        offset,
        buffer.length - offset,
        offset
      );
      if (bytesRead === 0) {
        break;
      }
      offset += bytesRead;
    }
    return buffer.subarray(0, offset);
  } finally {
    await fileHandle.close();
  }
}

// find any open document whose normalized filesystem path matches the module
function findOpenDocument(fsPath: string): vscode.TextDocument | undefined {
  const normalizedFsPath = normalizePathForComparison(fsPath);
  return vscode.workspace.textDocuments.find(
    (document) =>
      normalizePathForComparison(document.uri.fsPath) === normalizedFsPath
  );
}

// apply the fetch timeout across open, stat, bounded read, & close
function readModuleFileWithTimeout(
  fsPath: string,
  includeContents: boolean
): Promise<Buffer | null> {
  return raceTimeout(readModuleFile(fsPath, includeContents), {
    timeoutMs: MODULE_FETCH_TIMEOUT_MS,
    errorMessage:
      `Module fetch timed out after ${MODULE_FETCH_TIMEOUT_MS / 1000}s: ` +
      `${path.basename(fsPath)}`,
  });
}

// retain host-only watch paths without exposing them to the browser runtime
function finalizeHandlerResult(
  result: FileTypeHandlerResult,
  preview: Preview,
  ownerFsPath: string,
  dependencyGeneration: number
): FetchResult {
  const { watchFiles, ...fetchResult } = result;
  preview.commitModuleDependencySnapshot(
    ownerFsPath,
    result.dependencies,
    watchFiles,
    dependencyGeneration
  );
  return fetchResult;
}

export async function fetchLocal(
  request: string,
  isBare: boolean,
  parentId: string,
  preview: Preview,
  dependencyKind: ModuleDependencyKind = 'require'
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
    const dependencyGeneration = preview.dependencyGeneration;

    // check for Node.js core modules early (handles both `fs` & `node:fs` forms)
    const normalizedRequest = normalizeNodePrefix(request);
    if (isBare && isCoreModule(request)) {
      return buildNoopResult(normalizedRequest);
    }

    const resolutionContext = buildResolutionContext({
      baseDir: path.dirname(parentId),
      tsConfig: preview.typescriptConfiguration,
      documentUri: preview.doc.uri,
      entryFsDirectory,
      dependencyKind,
    });
    const executionContext: ModuleExecutionContext = {
      documentUri: preview.doc.uri,
      entryFsDirectory,
      useSucraseTranspiler: preview.configuration.useSucraseTranspiler,
      getWebviewUri: (fsPath) => preview.getWebviewUri(fsPath),
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

    const diskFsPath = resolution.fsPath;

    if (!(await checkFsPathAsync(entryFsDirectory, diskFsPath))) {
      // fallback check for core modules that resolved to paths outside allowed directories
      if (isCoreModule(request)) {
        return buildNoopResult(normalizedRequest);
      }
      throw new PathAccessDeniedError(diskFsPath);
    }

    const extname = path.extname(diskFsPath).toLowerCase();
    const fsPath =
      path.sep === '\\' ? normalizePathSeparators(diskFsPath) : diskFsPath;

    // image handlers only need the validated path to create a webview URI
    if ((IMAGE_EXTENSIONS as readonly string[]).includes(extname)) {
      await readModuleFileWithTimeout(diskFsPath, false);
      const imageResult = await handleByExtension(
        '',
        fsPath,
        extname,
        executionContext
      );
      if (imageResult) {
        return finalizeHandlerResult(
          imageResult,
          preview,
          diskFsPath,
          dependencyGeneration
        );
      }
    }

    let code: string;
    const openDocument =
      preview.configuration.updateMode === 'onType'
        ? findOpenDocument(diskFsPath)
        : undefined;
    if (openDocument) {
      code = openDocument.getText();
      enforceModuleSize(diskFsPath, Buffer.byteLength(code, 'utf8'));
    } else {
      const buffer = await readModuleFileWithTimeout(diskFsPath, true);
      if (!buffer) {
        throw new Error(`Module "${path.basename(fsPath)}" could not be read`);
      }

      if (isBinaryBuffer(buffer)) {
        throw new Error(
          `Cannot import binary file "${path.basename(fsPath)}" (${extname}). ` +
            `Binary files like images should be referenced via URL or data URI.`
        );
      }
      code = buffer.toString('utf-8');
    }

    // dispatch to appropriate file type handler
    let result = await handleByExtension(
      code,
      fsPath,
      extname,
      executionContext
    );
    if (!result) {
      // fallback for unknown file types - treat as script
      result = await getScriptHandler().handle(code, fsPath, executionContext);
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

    return finalizeHandlerResult(
      result,
      preview,
      diskFsPath,
      dependencyGeneration
    );
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
