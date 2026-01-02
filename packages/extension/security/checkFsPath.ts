// packages/extension/security/checkFsPath.ts
// ! validate file paths are inside workspace folders (prevents path traversal attacks)

import * as vscode from 'vscode';
import * as path from 'path';

// check if path is inside another path (replaces deprecated path-is-inside package)
function isPathInside(childPath: string, parentPath: string): boolean {
  const relative = path.relative(parentPath, childPath);
  return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

const rootDirectoryCache = new Map<string, string>();

// get root directory path for entry file
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

// clear cache when workspace folders change
export function handleDidChangeWorkspaceFolders(): void {
  rootDirectoryCache.clear();
}

// ! check if file path is inside workspace (security validation)
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

class CustomError extends Error {
  constructor(...args: string[]) {
    super(...args);
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = new.target.name;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, new.target);
    }
  }
}

// path access denied error (thrown when accessing files outside workspace)
export class PathAccessDeniedError extends CustomError {
  fsPath: string;

  constructor(fsPath: string) {
    super(
      `Accessing ${fsPath} denied. This path is outside of your workspace folders. Please make sure you have all dependencies inside your workspace.`
    );
    this.fsPath = fsPath;
  }
}
