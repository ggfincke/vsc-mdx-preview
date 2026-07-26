// scripts/check-generated-files.mjs
// enforce exact generated-file manifest membership & output presence

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  compareGeneratedOutputSets,
  GENERATED_HEADER_FILES,
  GENERATED_OUTPUTS,
} from './generated-files.mjs';
import { collectFiles } from './lib/file-walk.mjs';
import { IGNORED_DIRECTORIES } from './lib/ignore.mjs';

const HEADER = '// AUTO-GENERATED FILE - DO NOT EDIT';
const SOURCE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
]);

try {
  const rootDir = process.cwd();

  const sourceFiles = collectFiles({
    rootDir,
    extensions: SOURCE_EXTENSIONS,
    ignoredDirectories: IGNORED_DIRECTORIES,
    pathMode: 'relative',
  });

  const actualGeneratedFiles = sourceFiles.filter((file) => {
    const content = readFileSync(join(rootDir, file), 'utf-8');
    const firstLine = content.split(/\r?\n/, 1)[0]?.trim() ?? '';
    return firstLine.startsWith(HEADER);
  });
  const { missing, extra } = compareGeneratedOutputSets(
    GENERATED_HEADER_FILES,
    actualGeneratedFiles
  );
  const missingNonHeaderOutputs = GENERATED_OUTPUTS.filter(
    (output) =>
      !output.hasGeneratedHeader && !existsSync(join(rootDir, output.path))
  ).map((output) => output.path);

  if (missing.length > 0) {
    console.error('Expected generated files missing or missing their header:');
    for (const file of missing) {
      console.error(`  - ${file}`);
    }
  }
  if (extra.length > 0) {
    console.error('Generated files missing from the output manifest:');
    for (const file of extra) {
      console.error(`  - ${file}`);
    }
  }
  if (missingNonHeaderOutputs.length > 0) {
    console.error('Generated or synced outputs missing:');
    for (const file of missingNonHeaderOutputs) {
      console.error(`  - ${file}`);
    }
  }

  if (
    missing.length > 0 ||
    extra.length > 0 ||
    missingNonHeaderOutputs.length > 0
  ) {
    console.error('\nRun "npm run prebuild" to regenerate expected outputs.');
    process.exit(1);
  }

  console.log(
    `Generated output manifest matches exactly: ${actualGeneratedFiles.length} ` +
      `header-generated files, ${GENERATED_OUTPUTS.length} total outputs.`
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Error checking generated files:', message);
  process.exit(1);
}
