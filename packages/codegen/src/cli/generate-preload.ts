// packages/codegen/src/cli/generate-preload.ts
// script entry point for generating webview preload files

import * as path from 'path';
import {
  generatePreloadAliasesTs,
  generatePreloadTs,
} from '../lib/generate-preload';
import {
  getGeneratedOutput,
  loadGeneratedOutputManifest,
  resolveGeneratedOutputPath,
} from '../lib/generated-output-manifest';
import { ensureDir, writeGeneratedFile, getRootDir } from './cli-utils';

const ROOT_DIR = getRootDir(import.meta.url);
const WEBVIEW_SRC_DIR = path.join(ROOT_DIR, 'packages/webview-client/src');
const OUTPUT_MANIFEST = loadGeneratedOutputManifest(ROOT_DIR);
const PRELOAD_OUTPUT_PATH = resolveGeneratedOutputPath(
  ROOT_DIR,
  getGeneratedOutput(OUTPUT_MANIFEST, 'preload.modules')
);
const ALIASES_OUTPUT_PATH = resolveGeneratedOutputPath(
  ROOT_DIR,
  getGeneratedOutput(OUTPUT_MANIFEST, 'preload.aliases')
);
const OUTPUT_DIR = path.dirname(PRELOAD_OUTPUT_PATH);

function main(): void {
  console.log('Generating preload files...');
  ensureDir(OUTPUT_DIR);

  const preloadContent = generatePreloadTs({
    outputDir: OUTPUT_DIR,
    webviewSrcDir: WEBVIEW_SRC_DIR,
  });
  writeGeneratedFile(PRELOAD_OUTPUT_PATH, preloadContent);

  const aliasesContent = generatePreloadAliasesTs();
  writeGeneratedFile(ALIASES_OUTPUT_PATH, aliasesContent);

  console.log('Done.');
}

main();
