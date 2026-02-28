// packages/extension-host/src/features/module-runtime/security/checkFsPath.ts
// ! validate file paths are inside workspace folders (prevents path traversal attacks)

import * as vscode from 'vscode';
import * as path from 'path';
import { STANDARD_CACHE_TTL_MS } from '@mdx-preview/contracts';
import { LRUCache } from '@mdx-preview/runtime-utils';
import { PATH_CACHE_MAX_ENTRIES } from '../../../shared/constants/runtime';

// re-export PathAccessDeniedError from centralized errors module
export { PathAccessDeniedError } from '../../../shared/errors';

// use shared path utilities
import {
  isPathInside,
  isPathInsideAsync,
  resolveRealPath,
  normalizePathForComparison,
} from '../../../shared/utils/path-utils';

// cache for resolved workspace roots by entry directory
const asyncRootDirectoryCache = new LRUCache<string, string>({
  maxEntries: PATH_CACHE_MAX_ENTRIES,
  ttlMs: STANDARD_CACHE_TTL_MS,
});

// cache for resolved real paths (symlink resolution)
const realPathCache = new LRUCache<string, string>({
  maxEntries: PATH_CACHE_MAX_ENTRIES,
  ttlMs: STANDARD_CACHE_TTL_MS,
});

// get cached real path (async w/ caching)
async function getCachedRealPath(filePath: string): Promise<string | null> {
  const cacheKey = normalizePathForComparison(filePath);
  const cached = realPathCache.get(cacheKey);
  if (cached !== null) {
    return cached;
  }
  const realPath = await resolveRealPath(filePath);
  if (realPath) {
    realPathCache.set(cacheKey, realPath);
  }
  return realPath;
}

// get root directory path for entry file (async w/ symlink resolution)
// fall back to sync behavior if paths don't exist (for tests & new files)
async function getRootDirectoryPathAsync(
  entryFsDirectory: string
): Promise<string | undefined> {
  // try to resolve real path for entry directory
  const realEntryDir = await getCachedRealPath(entryFsDirectory);

  // if realpath fails (path doesn't exist), use normalized path
  const effectiveEntryDir = realEntryDir || path.normalize(entryFsDirectory);

  const cacheKey = normalizePathForComparison(effectiveEntryDir);
  const cached = asyncRootDirectoryCache.get(cacheKey);
  if (cached !== null) {
    return cached;
  }

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    return undefined;
  }

  // find workspace folders that contain the entry directory
  const matchingFolders: string[] = [];
  for (const folder of workspaceFolders) {
    // try to resolve real path for workspace folder
    const realFolderPath = await getCachedRealPath(folder.uri.fsPath);
    const effectiveFolderPath =
      realFolderPath || path.normalize(folder.uri.fsPath);

    // use sync isPathInside if paths don't exist (for unit tests)
    const isInside =
      realFolderPath && realEntryDir
        ? await isPathInsideAsync(effectiveEntryDir, effectiveFolderPath)
        : isPathInside(effectiveEntryDir, effectiveFolderPath);

    if (isInside) {
      matchingFolders.push(effectiveFolderPath);
    }
  }

  // sort by path length (shortest = most specific workspace)
  matchingFolders.sort((a, b) => a.length - b.length);
  const rootDirectory = matchingFolders[0];

  if (rootDirectory) {
    asyncRootDirectoryCache.set(cacheKey, rootDirectory);
    return rootDirectory;
  }

  return undefined;
}

// clear all caches when workspace folders change
export function handleDidChangeWorkspaceFolders(): void {
  asyncRootDirectoryCache.clear();
  realPathCache.clear();
}

// ! async check if file path is inside workspace (security validation w/ symlink resolution)
// use for security-critical checks - resolve symlinks & handle case-insensitivity
export async function checkFsPathAsync(
  entryFsDirectory: string,
  fsPath: string
): Promise<boolean> {
  const rootDirectory = await getRootDirectoryPathAsync(entryFsDirectory);
  if (!rootDirectory) {
    return false;
  }

  // resolve real path for target file
  const realFsPath = await getCachedRealPath(fsPath);
  if (!realFsPath) {
    // file doesn't exist yet - use normalized path for check
    // handle the case of checking a path before it's created
    const normalized = normalizePathForComparison(path.normalize(fsPath));
    const normalizedRoot = normalizePathForComparison(rootDirectory);
    const relative = path.relative(normalizedRoot, normalized);
    return (
      !!relative && !relative.startsWith('..') && !path.isAbsolute(relative)
    );
  }

  return isPathInsideAsync(realFsPath, rootDirectory);
}

// clear all path security caches (for testing & disposal)
export function clearPathSecurityCaches(): void {
  asyncRootDirectoryCache.clear();
  realPathCache.clear();
}
