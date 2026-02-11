// packages/codegen/src/cli/generate-schema.ts
// script entry point for generating mdx-previewrc.schema.json

import * as path from 'path';
import { generateConfigSchemaJson } from '../lib/generate-config-schema';
import { writeGeneratedFile, getRootDir } from './cli-utils';

const ROOT_DIR = getRootDir(import.meta.url);
const SCHEMA_PATH = path.join(ROOT_DIR, 'schemas/mdx-previewrc.schema.json');

function main(): void {
  console.log('Generating mdx-previewrc.schema.json...');

  const schemaJson = generateConfigSchemaJson();
  writeGeneratedFile(SCHEMA_PATH, schemaJson);

  console.log('Done.');
}

main();
