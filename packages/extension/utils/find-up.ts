// packages/extension/utils/find-up.ts
// unified upward directory traversal for config file discovery
//
// consolidates repeated "find up" patterns from
// - ConfigResolver.ts (find .mdx-previewrc.json)
// - TypeScriptConfigResolver.ts (find tsconfig.json)
// - FrameworkDetector.ts (find package.json)
// - MetaResolver.ts (find _meta.json)
// - TailwindDetector.ts (find tailwind.config.*)

import * as path from 'path';
import { pathExists } from './file-utils';

// options for findUp
export interface FindUpOptions {
  // file name(s) to search for (can be string or array)
  filename: string | string[];

  // directory to start searching from
  startDir: string;

  // stop searching at these boundaries (exclusive)
  // - string: stop when reaching this directory
  // - string[]: stop when reaching any of these directories
  // - function: stop when predicate returns true
  // - undefined: search to filesystem root
  stopAt?: string | string[] | ((dir: string) => boolean);

  // return type
  // - 'file': returns full path to found file (default)
  // - 'directory': returns directory containing the file
  returnType?: 'file' | 'directory';
}

// search upward from startDir for a file matching filename(s)
// stops at workspace boundary, custom boundary, or filesystem root
// return found path or undefined if not found
// example
// // Find .mdx-previewrc.json, stop at workspace root
// findUp({
//   filename: ['.mdx-previewrc.json', '.mdx-previewrc'],
//   startDir: documentDir,
//   stopAt: createWorkspaceStopPredicate(),
// });
//
// example
// // Find tsconfig.json, search to filesystem root
// findUp({
//   filename: 'tsconfig.json',
//   startDir: directory
// })
//
// example
// // Find package.json, return containing directory
// findUp({
//   filename: 'package.json',
//   startDir: documentDir,
//   stopAt: workspaceRoot,
//   returnType: 'directory'
// })
export function findUp(options: FindUpOptions): string | undefined {
  const { filename, startDir, stopAt, returnType = 'file' } = options;

  const filenames = Array.isArray(filename) ? filename : [filename];
  let currentDir = startDir;

  // build stop predicate
  const shouldStop = buildStopPredicate(stopAt);

  while (currentDir) {
    // check each filename in order (first match wins)
    for (const name of filenames) {
      const candidate = path.join(currentDir, name);
      if (pathExists(candidate)) {
        return returnType === 'directory' ? currentDir : candidate;
      }
    }

    // check stop conditions AFTER checking for file
    // (so we still find files AT the stop boundary)
    if (shouldStop(currentDir)) {
      break;
    }

    // move up to parent directory
    const parentDir = path.dirname(currentDir);

    // detect filesystem root (path.dirname returns same path at root)
    if (parentDir === currentDir) {
      break;
    }

    currentDir = parentDir;
  }

  return undefined;
}

// build a stop condition predicate from various input types
function buildStopPredicate(
  stopAt: FindUpOptions['stopAt']
): (dir: string) => boolean {
  if (!stopAt) {
    // no stop condition - only stops at filesystem root
    return () => false;
  }

  if (typeof stopAt === 'function') {
    return stopAt;
  }

  // normalize to array for both string & string[] cases
  const stops = Array.isArray(stopAt) ? stopAt : [stopAt];
  return (dir: string) => stops.includes(dir);
}

// create a stop predicate that stops at any VS Code workspace root
// example:
// findUp({
//   filename: 'config.json',
//   startDir: docDir,
//   stopAt: createWorkspaceStopPredicate(),
// });
export function createWorkspaceStopPredicate(): (dir: string) => boolean {
  // dynamic import to avoid issues in non-VS Code environments (e.g., tests)
  const vscode = require('vscode') as typeof import('vscode');
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const workspaceRoots = workspaceFolders?.map((f) => f.uri.fsPath) ?? [];

  return (dir: string) => workspaceRoots.includes(dir);
}

// create a stop predicate that stops when leaving a parent directory
// (uses startsWith to check containment)
// example:
// // Stop when outside workspace root
// findUp({
//   filename: '_meta.json',
//   startDir: docDir,
//   stopAt: createContainmentStopPredicate(workspaceRoot),
// });
export function createContainmentStopPredicate(
  parentDir: string
): (dir: string) => boolean {
  return (dir: string) => !dir.startsWith(parentDir);
}
