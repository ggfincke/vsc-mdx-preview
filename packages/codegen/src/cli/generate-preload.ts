// packages/codegen/src/cli/generate-preload.ts
// script entry point for generating webview preload files

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'node:url';
import {
  generatePreloadAliasesTs,
  generatePreloadTs,
} from '../lib/generate-preload';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../../..');
const WEBVIEW_SRC_DIR = path.join(ROOT_DIR, 'packages/webview-client/src');
const OUTPUT_DIR = path.join(WEBVIEW_SRC_DIR, 'generated', 'preload');

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function writeFile(filePath: string, content: string): void {
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`  ✓ ${filePath}`);
}

function main(): void {
  console.log('Generating preload files...');
  ensureDir(OUTPUT_DIR);

  const preloadContent = generatePreloadTs({
    outputDir: OUTPUT_DIR,
    webviewSrcDir: WEBVIEW_SRC_DIR,
  });
  writeFile(path.join(OUTPUT_DIR, 'preload.generated.ts'), preloadContent);

  const aliasesContent = generatePreloadAliasesTs();
  writeFile(path.join(OUTPUT_DIR, 'aliases.generated.ts'), aliasesContent);

  console.log('Done.');
}

main();
