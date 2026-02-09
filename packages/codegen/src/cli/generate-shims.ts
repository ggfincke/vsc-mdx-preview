// packages/codegen/src/cli/generate-shims.ts
// generate shim barrels & framework CSS loader

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'node:url';
import {
  generateFrameworkCssLoaderTs,
  generateShimBarrelFiles,
} from '../lib/generate-shims';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../../..');
const WEBVIEW_SRC_DIR = path.join(ROOT_DIR, 'packages/webview-client/src');

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function writeFile(filePath: string, content: string): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`  OK ${filePath}`);
}

function main(): void {
  console.log('Generating shim barrels & framework CSS loader...');

  const cssLoader = generateFrameworkCssLoaderTs({
    webviewSrcDir: WEBVIEW_SRC_DIR,
  });
  writeFile(cssLoader.outputPath, cssLoader.content);

  const barrels = generateShimBarrelFiles({
    webviewSrcDir: WEBVIEW_SRC_DIR,
  });

  for (const file of barrels) {
    writeFile(file.outputPath, file.content);
  }

  console.log('Done.');
}

main();
