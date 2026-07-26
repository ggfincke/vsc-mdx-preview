// packages/extension-host/src/features/module-runtime/security/checkFsPath.ts
// ! validate file paths are inside workspace folders (prevents path traversal attacks)

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { STANDARD_CACHE_TTL_MS } from '@mdx-preview/contracts';
import { LRUCache } from '@mdx-preview/runtime-utils';
import { PATH_CACHE_MAX_ENTRIES } from '../../../shared/constants/runtime';

// re-export PathAccessDeniedError from centralized errors module
export { PathAccessDeniedError } from '../../../shared/errors';

// use shared path utilities
import {
  isPathWithin,
  isPathWithinAsync,
  resolveRealPath,
  normalizePathForComparison,
} from '../../../shared/utils/path-utils';

// cache for resolved workspace roots by entry directory
const asyncRootDirectoryCache = new LRUCache<string, string>({
  maxEntries: PATH_CACHE_MAX_ENTRIES,
  ttlMs: STANDARD_CACHE_TTL_MS,
});

// resolved path bound to the followed target identity
interface RealPathCacheEntry {
  realPath: string;
  device: number;
  inode: number;
}

// cache resolved paths alongside the current followed-file identity
const realPathCache = new LRUCache<string, RealPathCacheEntry>({
  maxEntries: PATH_CACHE_MAX_ENTRIES,
  ttlMs: STANDARD_CACHE_TTL_MS,
});

// read the identity reached through every symlink in the requested path
async function getFileIdentity(
  filePath: string
): Promise<{ device: number; inode: number } | null> {
  try {
    const stats = await fs.promises.stat(filePath);
    return { device: stats.dev, inode: stats.ino };
  } catch {
    return null;
  }
}

// compare identities from the requested path & resolved target
function isSameFileIdentity(
  left: { device: number; inode: number },
  right: { device: number; inode: number }
): boolean {
  return left.device === right.device && left.inode === right.inode;
}

// bind a realpath to a matching identity even if a symlink moves mid-resolution
async function resolveCurrentRealPath(
  filePath: string
): Promise<RealPathCacheEntry | null> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const realPath = await resolveRealPath(filePath);
    if (!realPath) {
      return null;
    }

    const [requestedIdentity, resolvedIdentity] = await Promise.all([
      getFileIdentity(filePath),
      getFileIdentity(realPath),
    ]);
    if (
      requestedIdentity &&
      resolvedIdentity &&
      isSameFileIdentity(requestedIdentity, resolvedIdentity)
    ) {
      return { realPath, ...requestedIdentity };
    }
  }
  return null;
}

// get cached real path after validating its current target identity
async function getCachedRealPath(filePath: string): Promise<string | null> {
  const cacheKey = normalizePathForComparison(filePath);
  const cached = realPathCache.get(cacheKey);
  if (cached !== null) {
    const identity = await getFileIdentity(filePath);
    if (identity && isSameFileIdentity(identity, cached)) {
      return cached.realPath;
    }
    realPathCache.delete(cacheKey);
  }

  const entry = await resolveCurrentRealPath(filePath);
  if (entry) {
    realPathCache.set(cacheKey, entry);
  }
  return entry?.realPath ?? null;
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

    // use sync containment if paths don't exist (for unit tests)
    const isInside =
      realFolderPath && realEntryDir
        ? await isPathWithinAsync(effectiveEntryDir, effectiveFolderPath, false)
        : isPathWithin(effectiveEntryDir, effectiveFolderPath, false);

    if (isInside) {
      matchingFolders.push(effectiveFolderPath);
    }
  }

  // sort by path length (longest = most specific workspace)
  matchingFolders.sort((a, b) => b.length - a.length);
  const rootDirectory = matchingFolders[0];

  if (rootDirectory) {
    asyncRootDirectoryCache.set(cacheKey, rootDirectory);
    return rootDirectory;
  }

  return undefined;
}

// clear all caches when workspace folders change
export function handleDidChangeWorkspaceFolders(): void {
  clearPathSecurityCaches();
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
    return isPathWithin(fsPath, rootDirectory, false);
  }

  return isPathWithinAsync(realFsPath, rootDirectory, false);
}

// clear all path security caches (for testing & disposal)
export function clearPathSecurityCaches(): void {
  asyncRootDirectoryCache.clear();
  realPathCache.clear();
}
