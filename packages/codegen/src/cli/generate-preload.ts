// packages/codegen/src/cli/generate-preload.ts
// script entry point for generating webview preload files

import * as path from 'path';
import {
  generatePreloadAliasesTs,
  generatePreloadTs,
} from '../lib/generate-preload';
import { ensureDir, writeGeneratedFile, getRootDir } from './cli-utils';

const ROOT_DIR = getRootDir(import.meta.url);
const WEBVIEW_SRC_DIR = path.join(ROOT_DIR, 'packages/webview-client/src');
const OUTPUT_DIR = path.join(WEBVIEW_SRC_DIR, 'generated', 'preload');

function main(): void {
  console.log('Generating preload files...');
  ensureDir(OUTPUT_DIR);

  const preloadContent = generatePreloadTs({
    outputDir: OUTPUT_DIR,
    webviewSrcDir: WEBVIEW_SRC_DIR,
  });
  writeGeneratedFile(
    path.join(OUTPUT_DIR, 'preload.generated.ts'),
    preloadContent
  );

  const aliasesContent = generatePreloadAliasesTs();
  writeGeneratedFile(
    path.join(OUTPUT_DIR, 'aliases.generated.ts'),
    aliasesContent
  );

  console.log('Done.');
}

main();
