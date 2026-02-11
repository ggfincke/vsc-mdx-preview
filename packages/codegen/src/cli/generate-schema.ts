// packages/codegen/src/cli/generate-schema.ts
// script entry point for generating mdx-previewrc.schema.json

import * as path from 'path';
import { fileURLToPath } from 'node:url';
import { generateConfigSchemaJson } from '../lib/generate-config-schema';
import { writeGeneratedFile } from './cli-utils';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../../..');
const SCHEMA_PATH = path.join(ROOT_DIR, 'schemas/mdx-previewrc.schema.json');

function main(): void {
  console.log('Generating mdx-previewrc.schema.json...');

  const schemaJson = generateConfigSchemaJson();
  writeGeneratedFile(SCHEMA_PATH, schemaJson);

  console.log('Done.');
}

main();
