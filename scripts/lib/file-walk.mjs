// scripts/lib/file-walk.mjs
// shared recursive file walker for guardrail scripts

import { readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

export function normalizePath(filePath) {
  return filePath.replaceAll('\\', '/');
}

export function collectFiles({
  rootDir,
  startDir = rootDir,
  extensions,
  ignoredDirectories = new Set(),
  recursive = true,
  pathMode = 'absolute',
  includeFile = () => true,
}) {
  const files = [];
  const entries = readdirSync(startDir, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = join(startDir, entry.name);

    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name)) {
        continue;
      }

      if (recursive) {
        files.push(
          ...collectFiles({
            rootDir,
            startDir: absolutePath,
            extensions,
            ignoredDirectories,
            recursive,
            pathMode,
            includeFile,
          })
        );
      }
      continue;
    }

    if (extensions && !extensions.has(extname(entry.name))) {
      continue;
    }

    if (!includeFile(absolutePath, entry)) {
      continue;
    }

    files.push(
      pathMode === 'relative'
        ? normalizePath(relative(rootDir, absolutePath))
        : absolutePath
    );
  }

  return files;
}
