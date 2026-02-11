// packages/codegen/src/cli/cli-utils.ts
// shared file I/O utilities for codegen CLI scripts

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'node:url';

// ensure a directory exists, creating it recursively if needed
export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

// write content to a file & log the result
export function writeGeneratedFile(filePath: string, content: string): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`  OK ${filePath}`);
}

// resolve monorepo root from any CLI script's import.meta.url
export function getRootDir(importMetaUrl: string): string {
  const filename = fileURLToPath(importMetaUrl);
  const dir = path.dirname(filename);
  return path.resolve(dir, '../../../..');
}
