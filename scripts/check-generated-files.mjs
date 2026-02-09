// scripts/check-generated-files.mjs
// check that auto-generated files only exist in allowed directories
// use git grep to find files whose first line contains the generated header
// exit code 0 = all generated files are in allowed locations
// exit code 1 = generated files found in unexpected locations

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const ALLOWED_PATTERNS = [
  'packages/webview-app/src/module-system/preload/',
  'packages/webview-app/src/components/shims/',
  'packages/webview-app/src/utils/frameworkCssLoader.ts',
];

const HEADER = '// AUTO-GENERATED FILE - DO NOT EDIT';

try {
  // find files where line 1 contains the generated header
  const output = execSync(
    `git grep -l --fixed-strings "${HEADER}" -- "*.ts" "*.tsx"`,
    { encoding: 'utf-8' }
  ).trim();

  if (!output) {
    console.log('No generated files found.');
    process.exit(0);
  }

  const files = output.split('\n').filter(Boolean);
  const violations = [];

  for (const file of files) {
    // read just the first line to confirm it's actually a generated file header
    // (not a codegen source that references the string as a constant)
    const firstLine = readFileSync(file, 'utf-8').split('\n')[0].trim();

    if (!firstLine.startsWith(HEADER)) {
      continue;
    }

    const isAllowed = ALLOWED_PATTERNS.some((pattern) =>
      file.startsWith(pattern)
    );
    if (!isAllowed) {
      violations.push(file);
    }
  }

  if (violations.length > 0) {
    console.error('Generated files found in unexpected locations:');
    for (const v of violations) {
      console.error(`  - ${v}`);
    }
    console.error('\nAllowed locations:');
    for (const p of ALLOWED_PATTERNS) {
      console.error(`  - ${p}`);
    }
    process.exit(1);
  }

  console.log(
    `All ${files.length} generated file(s) are in allowed locations.`
  );
  process.exit(0);
} catch (error) {
  // git grep exits w/ code 1 when no matches found — that's OK
  if (error.status === 1 && !error.stderr) {
    console.log('No generated files found.');
    process.exit(0);
  }
  console.error('Error checking generated files:', error.message);
  process.exit(1);
}
