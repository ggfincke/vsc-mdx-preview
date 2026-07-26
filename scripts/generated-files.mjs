// scripts/generated-files.mjs
// load generated-output manifest projections for guardrail scripts

import { readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';

const GENERATORS = new Set(['settings', 'preload', 'shims', 'schema']);
const FORMATS = new Set(['json', 'typescript']);
const MODES = new Set(['generated', 'synced']);

const manifest = JSON.parse(
  readFileSync(
    new URL('./generated-output-manifest.json', import.meta.url),
    'utf-8'
  )
);
if (manifest.version !== 1 || !Array.isArray(manifest.outputs)) {
  throw new Error('Generated output manifest must use version 1');
}

const ids = new Set();
const paths = new Set();
for (const output of manifest.outputs) {
  if (
    typeof output.id !== 'string' ||
    !GENERATORS.has(output.generator) ||
    typeof output.path !== 'string' ||
    !FORMATS.has(output.format) ||
    !MODES.has(output.mode) ||
    typeof output.hasGeneratedHeader !== 'boolean'
  ) {
    throw new Error('Generated output manifest contains an invalid entry');
  }
  if (
    output.path.length === 0 ||
    isAbsolute(output.path) ||
    output.path.split(/[\\/]/).includes('..')
  ) {
    throw new Error(
      `Generated output path must be repository-relative: ${output.id}`
    );
  }
  if (ids.has(output.id) || paths.has(output.path)) {
    throw new Error(`Duplicate generated output: ${output.id}`);
  }
  ids.add(output.id);
  paths.add(output.path);
}

export const GENERATED_OUTPUTS = Object.freeze(
  manifest.outputs.map((output) => Object.freeze({ ...output }))
);
export const GENERATED_HEADER_FILES = Object.freeze(
  GENERATED_OUTPUTS.filter((output) => output.hasGeneratedHeader).map(
    (output) => output.path
  )
);
export const ALL_GENERATED_FILES = Object.freeze(
  GENERATED_OUTPUTS.map((output) => output.path)
);

export function compareGeneratedOutputSets(expectedFiles, actualFiles) {
  const expectedSet = new Set(expectedFiles);
  const actualSet = new Set(actualFiles);
  return {
    missing: expectedFiles.filter((file) => !actualSet.has(file)),
    extra: actualFiles.filter((file) => !expectedSet.has(file)),
  };
}
