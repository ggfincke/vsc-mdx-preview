#!/usr/bin/env node

// scripts/verify-codegen-idempotency.mjs
// verify generated files match what generators produce
// run AFTER generators (pretest pipeline) to catch stale committed files
// exit code 0 = all generated files are up to date
// exit code 1 = generated files are out of date (re-run generators)

import { execSync } from 'node:child_process';

// exhaustive list of files produced by generators
// TS generated files (codegen: preload, shims, framework-css)
const GENERATED_TS_FILES = [
  'packages/webview-client/src/generated/preload/preload.generated.ts',
  'packages/webview-client/src/generated/preload/aliases.generated.ts',
  'packages/webview-client/src/generated/framework-css/frameworkCssLoader.ts',
  'packages/webview-client/src/generated/shim-barrels/generic/index.ts',
  'packages/webview-client/src/generated/shim-barrels/docusaurus/index.ts',
  'packages/webview-client/src/generated/shim-barrels/starlight/index.ts',
  'packages/webview-client/src/generated/shim-barrels/nextra/index.ts',
  'packages/webview-client/src/generated/shim-barrels/nextjs/index.ts',
];

// JSON schema (codegen: generate-schema)
const GENERATED_JSON_FILES = ['schemas/mdx-previewrc.schema.json'];

// note: package.json is NOT included here because it is both manually edited
// & synced by generate-settings
// catch settings drift by verify:settings instead
const ALL_FILES = [...GENERATED_TS_FILES, ...GENERATED_JSON_FILES];

try {
  // check git diff on all generated/synced files
  // --exit-code makes git diff exit 1 if there are changes
  try {
    execSync(`git diff --exit-code -- ${ALL_FILES.join(' ')}`, {
      stdio: 'pipe',
      encoding: 'utf-8',
    });
  } catch (diffError) {
    // git diff exited non-zero = there are changes
    const diffOutput = diffError.stdout || '';
    const changedFiles = [];

    try {
      const nameOnly = execSync(
        `git diff --name-only -- ${ALL_FILES.join(' ')}`,
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
    `Codegen idempotency check passed. All ${ALL_FILES.length} generated/synced files are up to date.`
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Error running codegen idempotency check:', message);
  process.exit(1);
}
