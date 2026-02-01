// packages/extension/module-system/security/checkFsPath.ts
// ! validate file paths are inside workspace folders (prevents path traversal attacks)

import * as vscode from 'vscode';
import * as path from 'path';

// re-export PathAccessDeniedError from centralized errors module
export { PathAccessDeniedError } from '../../errors';

// use shared path utilities
import {
  isPathInside,
  isPathInsideAsync,
  resolveRealPath,
  normalizePathForComparison,
} from '../../utils/path-utils';

// cache for sync lookups (legacy)
const rootDirectoryCache = new Map<string, string>();

// cache for async lookups w/ symlink resolution
const asyncRootDirectoryCache = new Map<string, string>();
const realPathCache = new Map<string, string>();

// get cached real path (async w/ caching)
async function getCachedRealPath(filePath: string): Promise<string | null> {
  const cacheKey = normalizePathForComparison(filePath);
  if (realPathCache.has(cacheKey)) {
    return realPathCache.get(cacheKey)!;
  }
  const realPath = await resolveRealPath(filePath);
  if (realPath) {
    realPathCache.set(cacheKey, realPath);
  }
  return realPath;
}

// get root directory path for entry file (async w/ symlink resolution)
// falls back to sync behavior if paths don't exist (for tests & new files)
async function getRootDirectoryPathAsync(
  entryFsDirectory: string
): Promise<string | undefined> {
  // try to resolve real path for entry directory
  const realEntryDir = await getCachedRealPath(entryFsDirectory);

  // if realpath fails (path doesn't exist), use normalized path
  const effectiveEntryDir = realEntryDir || path.normalize(entryFsDirectory);

  const cacheKey = normalizePathForComparison(effectiveEntryDir);
  if (asyncRootDirectoryCache.has(cacheKey)) {
    return asyncRootDirectoryCache.get(cacheKey);
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

// get root directory path for entry file (sync, legacy)
function getRootDirectoryPath(entryFsDirectory: string): string | undefined {
  if (rootDirectoryCache.has(entryFsDirectory)) {
    return rootDirectoryCache.get(entryFsDirectory);
  }

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    return undefined;
  }

  const rootDirectories = workspaceFolders.filter((workspaceFolder) => {
    return isPathInside(entryFsDirectory, workspaceFolder.uri.fsPath);
  });

  const rootDirectory = rootDirectories.sort((d1, d2) => {
    return d1.uri.fsPath.length - d2.uri.fsPath.length;
  })[0];

  if (rootDirectory?.uri.fsPath) {
    const rootDirectoryPath = rootDirectory.uri.fsPath;
    rootDirectoryCache.set(entryFsDirectory, rootDirectoryPath);
    return rootDirectoryPath;
  }

  return undefined;
}

// clear all caches when workspace folders change
export function handleDidChangeWorkspaceFolders(): void {
  rootDirectoryCache.clear();
  asyncRootDirectoryCache.clear();
  realPathCache.clear();
}

// ! async check if file path is inside workspace (security validation w/ symlink resolution)
// use this for security-critical checks - resolves symlinks & handles case-insensitivity
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
    // this handles the case of checking a path before it's created
    const normalized = normalizePathForComparison(path.normalize(fsPath));
    const normalizedRoot = normalizePathForComparison(rootDirectory);
    const relative = path.relative(normalizedRoot, normalized);
    return (
      !!relative && !relative.startsWith('..') && !path.isAbsolute(relative)
    );
  }

  return isPathInsideAsync(realFsPath, rootDirectory);
}

// ! sync check if file path is inside workspace (legacy, no symlink resolution)
// deprecated: prefer checkFsPathAsync for full security
export function checkFsPath(entryFsDirectory: string, fsPath: string): boolean {
  const rootDirectory = getRootDirectoryPath(entryFsDirectory);
  if (!rootDirectory) {
    return false;
  }

  if (path.sep === '\\') {
    fsPath = path.normalize(fsPath);
  }

  return isPathInside(fsPath, rootDirectory);
}
