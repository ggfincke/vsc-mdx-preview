// scripts/check-generated-files.mjs
// check that auto-generated files only exist in allowed directories
// & that all expected generated files are present

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { GENERATED_TS_FILES } from './generated-files.mjs';

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

const EXPECTED_GENERATED_FILES = GENERATED_TS_FILES;

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

function checkExpectedFiles(rootDir) {
  const missing = [];

  for (const expectedFile of EXPECTED_GENERATED_FILES) {
    const absolutePath = join(rootDir, expectedFile);
    if (!existsSync(absolutePath)) {
      missing.push(expectedFile);
      continue;
    }

    // verify it has the expected header
    const content = readFileSync(absolutePath, 'utf-8');
    const firstLine = content.split(/\r?\n/, 1)[0]?.trim() ?? '';
    if (!firstLine.startsWith(HEADER)) {
      missing.push(
        `${expectedFile} (exists but missing AUTO-GENERATED header)`
      );
    }
  }

  return missing;
}

try {
  const rootDir = process.cwd();
  let hasFailures = false;

  // phase 1: scan for generated files in unexpected locations
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

  if (violations.length > 0) {
    console.error('Generated files found in unexpected locations:');
    for (const file of violations) {
      console.error(`  - ${file}`);
    }
    console.error('\nAllowed locations:');
    for (const pattern of ALLOWED_PATTERNS) {
      console.error(`  - ${pattern}`);
    }
    hasFailures = true;
  }

  // phase 2: verify expected files exist w/ correct headers
  const missing = checkExpectedFiles(rootDir);
  if (missing.length > 0) {
    console.error('\nExpected generated files missing or invalid:');
    for (const file of missing) {
      console.error(`  - ${file}`);
    }
    console.error('\nRun "npm run prebuild" to regenerate.');
    hasFailures = true;
  }

  if (hasFailures) {
    process.exit(1);
  }

  // phase 3: report success
  if (generatedFiles.length === 0) {
    console.error(
      'No generated files found — expected at least ' +
        `${EXPECTED_GENERATED_FILES.length}. Something is wrong.`
    );
    process.exit(1);
  }

  console.log(
    `All ${generatedFiles.length} generated file(s) are in allowed locations ` +
      `(${EXPECTED_GENERATED_FILES.length} expected, ${generatedFiles.length} found).`
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Error checking generated files:', message);
  process.exit(1);
}
