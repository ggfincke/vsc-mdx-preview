// packages/codegen/src/cli/generate-schema.ts
// script entry point for generating mdx-previewrc.schema.json

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'node:url';
import { generateConfigSchemaJson } from '../lib/generate-config-schema';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../../..');
const SCHEMA_PATH = path.join(ROOT_DIR, 'schemas/mdx-previewrc.schema.json');

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function main(): void {
  console.log('Generating mdx-previewrc.schema.json...');

  ensureDir(path.dirname(SCHEMA_PATH));

  const schemaJson = generateConfigSchemaJson();
  fs.writeFileSync(SCHEMA_PATH, schemaJson, 'utf-8');

  console.log(`  OK ${SCHEMA_PATH}`);
  console.log('Done.');
}

main();
