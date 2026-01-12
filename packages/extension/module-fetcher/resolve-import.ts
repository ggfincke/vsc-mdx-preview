// packages/extension/module-fetcher/resolve-import.ts
// shared utility for resolving relative imports to absolute paths
// used by TailwindScanner (async) & DependencyWatcher (sync) for import resolution
// import resolution failures are expected - returns null on "not found"

import * as fs from 'fs';
import * as path from 'path';
import { debug } from '../logging';

// default extensions to try when resolving imports
const DEFAULT_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mdx', '.md'];

// extensions to try for index files (subset of DEFAULT_EXTENSIONS)
const INDEX_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

export interface ResolveImportOptions {
  // extensions to try when resolving (default: .ts, .tsx, .js, .jsx, .mdx, .md)
  extensions?: string[];
  // extensions to try for index files (default: .ts, .tsx, .js, .jsx)
  indexExtensions?: string[];
}

// check if a specifier is a local/relative import (not a package)
// returns true for specifiers starting w/ './' or '../'
// returns false for URLs (http://, https://, npm://) & empty/null values
export function isLocalImport(specifier: string): boolean {
  if (!specifier) return false;
  if (specifier.startsWith('http://') || specifier.startsWith('https://'))
    return false;
  if (specifier.startsWith('npm://')) return false;
  return specifier.startsWith('./') || specifier.startsWith('../');
}

// resolve a relative import to an absolute path (async version)
// tries exact path, then w/ extensions, then index files
// baseDir: directory to resolve relative to
// specifier: import specifier (e.g., './Component')
// options: resolution options
// returns absolute path if found, null otherwise
export async function resolveImportAsync(
  baseDir: string,
  specifier: string,
  options: ResolveImportOptions = {}
): Promise<string | null> {
  const extensions = options.extensions ?? DEFAULT_EXTENSIONS;
  const indexExtensions = options.indexExtensions ?? INDEX_EXTENSIONS;
  const resolved = path.resolve(baseDir, specifier);

  // skip node_modules to avoid accidentally resolving to wrong packages
  if (resolved.includes('node_modules')) {
    return null;
  }

  // check if exact path exists & is a file
  try {
    const stat = await fs.promises.stat(resolved);
    if (stat.isFile()) {
      return resolved;
    }
  } catch {
    // expected - exact path doesn't exist, try w/ extensions
  }

  // try w/ extensions
  for (const ext of extensions) {
    const fullPath = resolved + ext;
    try {
      await fs.promises.access(fullPath);
      return fullPath;
    } catch {
      // expected - continue to next extension
    }
  }

  // try index files (for directory imports)
  for (const ext of indexExtensions) {
    const indexPath = path.join(resolved, `index${ext}`);
    try {
      await fs.promises.access(indexPath);
      return indexPath;
    } catch {
      // expected - continue to next extension
    }
  }

  debug(
    `[RESOLVE-IMPORT] Could not resolve import: ${specifier} from ${baseDir}`
  );
  return null;
}

// resolve a relative import to an absolute path (sync version)
// tries exact path, then w/ extensions, then index files
// baseDir: directory to resolve relative to
// specifier: import specifier (e.g., './Component')
// options: resolution options
// returns absolute path if found, null otherwise
export function resolveImportSync(
  baseDir: string,
  specifier: string,
  options: ResolveImportOptions = {}
): string | null {
  const extensions = options.extensions ?? DEFAULT_EXTENSIONS;
  const indexExtensions = options.indexExtensions ?? INDEX_EXTENSIONS;
  const resolved = path.resolve(baseDir, specifier);

  // skip node_modules to avoid accidentally resolving to wrong packages
  if (resolved.includes('node_modules')) {
    return null;
  }

  // check if exact path exists & is a file
  try {
    const stat = fs.statSync(resolved);
    if (stat.isFile()) {
      return resolved;
    }
  } catch {
    // expected - exact path doesn't exist, try w/ extensions
  }

  // try w/ extensions (single statSync call per extension instead of existsSync + statSync)
  for (const ext of extensions) {
    const fullPath = resolved + ext;
    try {
      const stat = fs.statSync(fullPath);
      if (stat.isFile()) {
        return fullPath;
      }
    } catch {
      // expected - continue to next extension
    }
  }

  // try index files (for directory imports)
  for (const ext of indexExtensions) {
    const indexPath = path.join(resolved, `index${ext}`);
    try {
      const stat = fs.statSync(indexPath);
      if (stat.isFile()) {
        return indexPath;
      }
    } catch {
      // expected - continue to next extension
    }
  }

  debug(
    `[RESOLVE-IMPORT] Could not resolve import: ${specifier} from ${baseDir}`
  );
  return null;
}
