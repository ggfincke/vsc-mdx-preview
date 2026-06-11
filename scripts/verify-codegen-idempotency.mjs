#!/usr/bin/env node
// scripts/verify-codegen-idempotency.mjs
// verify generated files match what generators produce
// run after generators to catch stale committed files

import { execSync } from 'node:child_process';
import { ALL_GENERATED_FILES } from './generated-files.mjs';

try {
  // check git diff on all generated/synced files
  // --exit-code makes git diff exit 1 if there are changes
  try {
    execSync(`git diff --exit-code -- ${ALL_GENERATED_FILES.join(' ')}`, {
      stdio: 'pipe',
      encoding: 'utf-8',
    });
  } catch (diffError) {
    // git diff exited non-zero = there are changes
    const diffOutput = diffError.stdout || '';
    const changedFiles = [];

    try {
      const nameOnly = execSync(
        `git diff --name-only -- ${ALL_GENERATED_FILES.join(' ')}`,
        { encoding: 'utf-8' }
      ).trim();

      if (nameOnly) {
        changedFiles.push(...nameOnly.split(/\r?\n/));
      }
    } catch {
      // fallback: just report generic failure
    }

    console.error('Codegen idempotency check FAILED.\n');
    console.error(
      'The following generated files are out of date (differ from what generators produce):\n'
    );

    for (const file of changedFiles) {
      console.error(`  - ${file}`);
    }

    console.error(
      '\nThis means source data changed but generated files were not re-committed.'
    );
    console.error(
      'To fix: run "npm run prebuild" and commit the updated generated files.\n'
    );

    if (diffOutput) {
      console.error('Diff:\n');
      console.error(diffOutput);
    }

    process.exit(1);
  }

  console.log(
    `Codegen idempotency check passed. All ${ALL_GENERATED_FILES.length} generated/synced files are up to date.`
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Error running codegen idempotency check:', message);
  process.exit(1);
}
