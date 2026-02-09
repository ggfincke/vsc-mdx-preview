// scripts/check-generated-files.mjs
// check that auto-generated files only exist in allowed directories
// scan the filesystem (tracked + untracked files) for *.ts and *.tsx
// exit code 0 = all generated files are in allowed locations
// exit code 1 = generated files found in unexpected locations

import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const ALLOWED_PATTERNS = ['packages/webview-client/src/generated/'];
const HEADER = '// AUTO-GENERATED FILE - DO NOT EDIT';
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const IGNORED_DIRECTORIES = new Set([
  '.git',
  '.vscode-test',
  'archive',
  'build',
  'coverage',
  'dist',
  'node_modules',
]);

function normalizePath(filePath) {
  return filePath.replaceAll('\\', '/');
}

function collectSourceFiles(rootDir, currentDir, output) {
  const entries = readdirSync(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = join(currentDir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }
      collectSourceFiles(rootDir, absolutePath, output);
      continue;
    }

    if (!SOURCE_EXTENSIONS.has(extname(entry.name))) {
      continue;
    }

    const relativePath = normalizePath(relative(rootDir, absolutePath));
    output.push(relativePath);
  }
}

try {
  const rootDir = process.cwd();
  const sourceFiles = [];
  collectSourceFiles(rootDir, rootDir, sourceFiles);

  const generatedFiles = [];
  const violations = [];

  for (const file of sourceFiles) {
    const fileContent = readFileSync(file, 'utf-8');
    const firstLine = fileContent.split(/\r?\n/, 1)[0]?.trim() ?? '';
    if (!firstLine.startsWith(HEADER)) {
      continue;
    }

    generatedFiles.push(file);
    const isAllowed = ALLOWED_PATTERNS.some((pattern) =>
      file.startsWith(pattern)
    );
    if (!isAllowed) {
      violations.push(file);
    }
  }

  if (generatedFiles.length === 0) {
    console.log('No generated files found.');
    process.exit(0);
  }

  if (violations.length > 0) {
    console.error('Generated files found in unexpected locations:');
    for (const file of violations) {
      console.error(`  - ${file}`);
    }
    console.error('\nAllowed locations:');
    for (const pattern of ALLOWED_PATTERNS) {
      console.error(`  - ${pattern}`);
    }
    process.exit(1);
  }

  console.log(
    `All ${generatedFiles.length} generated file(s) are in allowed locations.`
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Error checking generated files:', message);
  process.exit(1);
}
