#!/usr/bin/env node
// scripts/check-legacy-path-prefixes.mjs
// fail if deprecated monorepo path prefixes appear in active code/docs/tests

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const SCAN_ROOTS = ['packages', 'tests', 'docs'];
const ALLOWED_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.css',
  '.md',
  '.mdx',
]);
const IGNORED_DIRECTORIES = new Set([
  '.git',
  '.vscode-test',
  'archive',
  'build',
  'coverage',
  'dev-docs',
  'dist',
  'node_modules',
]);

const LEGACY_PATTERNS = [
  {
    label: 'packages/extension/',
    regex: /\bpackages\/extension\//,
  },
  {
    label: 'packages/webview-app/',
    regex: /\bpackages\/webview-app\//,
  },
];

function normalizePath(filePath) {
  return filePath.replaceAll('\\', '/');
}

function collectFiles(rootDir, currentDir, output) {
  const entries = readdirSync(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = join(currentDir, entry.name);

    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }

      collectFiles(rootDir, absolutePath, output);
      continue;
    }

    if (!ALLOWED_EXTENSIONS.has(extname(entry.name))) {
      continue;
    }

    output.push(absolutePath);
  }
}

function scanFile(rootDir, absolutePath) {
  const violations = [];
  const contents = readFileSync(absolutePath, 'utf-8');
  const lines = contents.split(/\r?\n/);
  const relativePath = normalizePath(relative(rootDir, absolutePath));

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    for (const pattern of LEGACY_PATTERNS) {
      if (!pattern.regex.test(line)) {
        continue;
      }

      violations.push({
        file: relativePath,
        line: i + 1,
        pattern: pattern.label,
        snippet: line.trim(),
      });
    }
  }

  return violations;
}

try {
  const rootDir = process.cwd();
  const filesToScan = [];

  for (const scanRoot of SCAN_ROOTS) {
    const scanPath = join(rootDir, scanRoot);
    if (!existsSync(scanPath)) {
      continue;
    }

    collectFiles(rootDir, scanPath, filesToScan);
  }

  const violations = [];
  for (const filePath of filesToScan) {
    violations.push(...scanFile(rootDir, filePath));
  }

  if (violations.length > 0) {
    console.error(
      `Legacy path prefix check FAILED (${violations.length} violation(s)).`
    );
    console.error(
      'Deprecated prefixes: packages/extension/, packages/webview-app/'
    );
    console.error('');

    for (const violation of violations) {
      console.error(
        `${violation.file}:${violation.line} [${violation.pattern}] ${violation.snippet}`
      );
    }

    process.exit(1);
  }

  console.log(
    `Legacy path prefix check passed (${filesToScan.length} file(s) scanned).`
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Error checking legacy path prefixes:', message);
  process.exit(1);
}
