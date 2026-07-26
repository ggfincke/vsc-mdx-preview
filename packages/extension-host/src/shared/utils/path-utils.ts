// packages/extension-host/src/shared/utils/path-utils.ts
// centralized path manipulation utilities for cross-platform compatibility
// import paths use forward slashes; absolute paths stay platform-native

import * as path from 'path';
import * as fs from 'fs';

// normalize path separators to forward slashes (for imports & URLs)
export function normalizePathSeparators(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

// convert a path to an absolute path, resolving relative to a base directory
export function toAbsolutePath(inputPath: string, baseDir: string): string {
  if (path.isAbsolute(inputPath)) {
    return inputPath;
  }
  return path.resolve(baseDir, inputPath);
}

// options for path resolution w/ fallbacks
export interface ResolvePathOptions {
  // path to resolve
  inputPath: string;
  // primary base directory to try first
  primaryDir?: string | null;
  // fallback directories to try in order
  fallbackDirs?: (string | null | undefined)[];
  // verify exists
  checkExists?: boolean;
}

// resolve a path w/ multiple fallback directories
export function resolvePathWithFallbacks(
  options: ResolvePathOptions
): string | null {
  const {
    inputPath,
    primaryDir,
    fallbackDirs = [],
    checkExists = false,
  } = options;

  // if absolute, return directly (optionally check exists)
  if (path.isAbsolute(inputPath)) {
    if (checkExists) {
      try {
        fs.accessSync(inputPath);
        return inputPath;
      } catch {
        return null;
      }
    }
    return inputPath;
  }

  // build ordered list of directories to try
  const dirsToTry: string[] = [];
  if (primaryDir) {
    dirsToTry.push(primaryDir);
  }
  for (const dir of fallbackDirs) {
    if (dir) {
      dirsToTry.push(dir);
    }
  }

  // if no directories to try, can't resolve
  if (dirsToTry.length === 0) {
    return null;
  }

  // try each directory
  for (const dir of dirsToTry) {
    const resolved = path.resolve(dir, inputPath);
    if (!checkExists) {
      // return first resolution w/o existence check
      return resolved;
    }
    try {
      fs.accessSync(resolved);
      return resolved;
    } catch {
      continue;
    }
  }

  return null;
}

// check if a path is a parent boundary or descendant
export function isPathWithin(
  targetPath: string,
  parentPath: string,
  allowEqual = true
): boolean {
  const normalizedTarget = normalizePathForComparison(targetPath);
  const normalizedParent = normalizePathForComparison(parentPath);
  const relative = path.relative(normalizedParent, normalizedTarget);
  return (
    (allowEqual && relative === '') ||
    (relative !== '..' &&
      !relative.startsWith(`..${path.sep}`) &&
      relative !== '' &&
      !path.isAbsolute(relative))
  );
}

// resolve real path w/ symlink resolution (async)
// return null if missing
export async function resolveRealPath(
  targetPath: string
): Promise<string | null> {
  try {
    return await fs.promises.realpath(targetPath);
  } catch {
    return null;
  }
}

// normalize path for case-insensitive comparison on Windows
// Windows NTFS is case-insensitive, so we lowercase for comparisons
export function normalizePathForComparison(filePath: string): string {
  const normalized = normalizePathSeparators(path.normalize(filePath));
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

// resolve symlinks before checking the canonical containment predicate
// ! use this for security-critical path checks
export async function isPathWithinAsync(
  targetPath: string,
  parentPath: string,
  allowEqual = true
): Promise<boolean> {
  // resolve symlinks for both paths
  const realTarget = await resolveRealPath(targetPath);
  const realParent = await resolveRealPath(parentPath);

  if (!realTarget || !realParent) {
    return false;
  }

  // normalize for case-insensitive filesystems (Windows)
  const normTarget = normalizePathForComparison(realTarget);
  const normParent = normalizePathForComparison(realParent);

  return isPathWithin(normTarget, normParent, allowEqual);
}
