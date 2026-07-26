// packages/codegen/src/cli/generate-schema.ts
// script entry point for generating mdx-previewrc.schema.json

import { generateConfigSchemaJson } from '../lib/generate-config-schema';
import {
  getGeneratedOutput,
  loadGeneratedOutputManifest,
  resolveGeneratedOutputPath,
} from '../lib/generated-output-manifest';
import { writeGeneratedFile, getRootDir } from './cli-utils';

const ROOT_DIR = getRootDir(import.meta.url);
const OUTPUT_MANIFEST = loadGeneratedOutputManifest(ROOT_DIR);
const SCHEMA_PATH = resolveGeneratedOutputPath(
  ROOT_DIR,
  getGeneratedOutput(OUTPUT_MANIFEST, 'schema.config')
);

function main(): void {
  console.log('Generating mdx-previewrc.schema.json...');

  const schemaJson = generateConfigSchemaJson();
  writeGeneratedFile(SCHEMA_PATH, schemaJson);

  console.log('Done.');
}

main();
