// packages/codegen/src/lib/generated-output-manifest.ts
// load & validate canonical generated-output paths for codegen CLIs

import * as fs from 'node:fs';
import * as path from 'node:path';

export type GeneratedOutputGenerator =
  'settings' | 'preload' | 'shims' | 'schema';
export type GeneratedOutputFormat = 'json' | 'typescript';
export type GeneratedOutputMode = 'generated' | 'synced';

export interface GeneratedOutput {
  id: string;
  generator: GeneratedOutputGenerator;
  path: string;
  format: GeneratedOutputFormat;
  mode: GeneratedOutputMode;
  hasGeneratedHeader: boolean;
}

export interface GeneratedOutputManifest {
  version: 1;
  outputs: readonly GeneratedOutput[];
}

const GENERATORS = new Set<GeneratedOutputGenerator>([
  'settings',
  'preload',
  'shims',
  'schema',
]);
const FORMATS = new Set<GeneratedOutputFormat>(['json', 'typescript']);
const MODES = new Set<GeneratedOutputMode>(['generated', 'synced']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseOutput(value: unknown, index: number): GeneratedOutput {
  if (!isRecord(value)) {
    throw new Error(`Generated output ${index} must be an object`);
  }

  const id = value.id;
  const generator = value.generator;
  const outputPath = value.path;
  const format = value.format;
  const mode = value.mode;
  const hasGeneratedHeader = value.hasGeneratedHeader;
  if (
    typeof id !== 'string' ||
    !GENERATORS.has(generator as GeneratedOutputGenerator) ||
    typeof outputPath !== 'string' ||
    !FORMATS.has(format as GeneratedOutputFormat) ||
    !MODES.has(mode as GeneratedOutputMode) ||
    typeof hasGeneratedHeader !== 'boolean'
  ) {
    throw new Error(`Generated output ${index} has an invalid shape`);
  }
  if (
    outputPath.length === 0 ||
    path.isAbsolute(outputPath) ||
    outputPath.split(/[\\/]/).includes('..')
  ) {
    throw new Error(
      `Generated output ${id} must use a repository-relative path`
    );
  }

  return {
    id,
    generator: generator as GeneratedOutputGenerator,
    path: outputPath.replaceAll('\\', '/'),
    format: format as GeneratedOutputFormat,
    mode: mode as GeneratedOutputMode,
    hasGeneratedHeader,
  };
}

export function loadGeneratedOutputManifest(
  rootDir: string
): GeneratedOutputManifest {
  const manifestPath = path.join(
    rootDir,
    'scripts/generated-output-manifest.json'
  );
  const value = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as unknown;
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !Array.isArray(value.outputs)
  ) {
    throw new Error('Generated output manifest must use version 1');
  }

  const outputs = value.outputs.map(parseOutput);
  const ids = new Set<string>();
  const paths = new Set<string>();
  for (const output of outputs) {
    if (ids.has(output.id)) {
      throw new Error(`Duplicate generated output id: ${output.id}`);
    }
    if (paths.has(output.path)) {
      throw new Error(`Duplicate generated output path: ${output.path}`);
    }
    ids.add(output.id);
    paths.add(output.path);
  }

  return { version: 1, outputs };
}

export function getGeneratedOutput(
  manifest: GeneratedOutputManifest,
  id: string
): GeneratedOutput {
  const output = manifest.outputs.find((candidate) => candidate.id === id);
  if (!output) {
    throw new Error(`Generated output manifest is missing id: ${id}`);
  }
  return output;
}

export function getGeneratedOutputsForGenerator(
  manifest: GeneratedOutputManifest,
  generator: GeneratedOutputGenerator
): readonly GeneratedOutput[] {
  return manifest.outputs.filter((output) => output.generator === generator);
}

export function resolveGeneratedOutputPath(
  rootDir: string,
  output: GeneratedOutput
): string {
  return path.join(rootDir, output.path);
}

export function assertGeneratedOutputPaths(
  rootDir: string,
  expectedOutputs: readonly GeneratedOutput[],
  actualPaths: readonly string[]
): void {
  const expected = new Set(
    expectedOutputs.map((output) =>
      path.normalize(resolveGeneratedOutputPath(rootDir, output))
    )
  );
  const actual = new Set(
    actualPaths.map((outputPath) => path.normalize(outputPath))
  );
  const missing = [...expected].filter((outputPath) => !actual.has(outputPath));
  const extra = [...actual].filter((outputPath) => !expected.has(outputPath));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `Generated output mismatch: missing [${missing.join(', ')}], extra [${extra.join(', ')}]`
    );
  }
}
