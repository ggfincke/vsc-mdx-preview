// packages/extension/utils/path-utils.ts
// centralized path manipulation utilities for cross-platform compatibility
//
// key conventions:
// - all import paths use forward slashes (even on Windows)
// - relative import paths start w/ './' or '../'
// - absolute paths are platform-native (use path.sep)

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

// convert an absolute path to a relative import path (w/ forward slashes)
export function toRelativeImportPath(
  absolutePath: string,
  fromDir: string
): string {
  let relativePath = path.relative(fromDir, absolutePath);

  // ensure path starts w/ ./ or ../ for valid import specifier
  if (!relativePath.startsWith('.') && !relativePath.startsWith('/')) {
    relativePath = './' + relativePath;
  }

  // normalize to forward slashes for import compatibility
  return normalizePathSeparators(relativePath);
}

// options for path resolution w/ fallbacks
export interface ResolvePathOptions {
  // the path to resolve (can be relative or absolute)
  inputPath: string;
  // primary base directory to try first
  primaryDir?: string | null;
  // fallback directories to try in order
  fallbackDirs?: (string | null | undefined)[];
  // if true, verify the resolved path exists before returning
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

// check if a child path is inside a parent path (security utility)
export function isPathInside(childPath: string, parentPath: string): boolean {
  const relative = path.relative(parentPath, childPath);
  return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

// join path segments & normalize to forward slashes
export function joinAsImportPath(...segments: string[]): string {
  return normalizePathSeparators(path.join(...segments));
}

// get the directory containing a file path
export function getDirectory(filePath: string): string {
  return path.dirname(filePath);
}

// get the file extension including the leading dot
export function getExtension(filePath: string): string {
  return path.extname(filePath);
}

// get the base name without extension
export function getBaseName(filePath: string): string {
  return path.basename(filePath, path.extname(filePath));
}
