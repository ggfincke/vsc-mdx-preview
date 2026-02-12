// packages/codegen/src/cli/generate-shims.ts
// generate shim barrels & framework CSS loader

import * as path from 'path';
import {
  generateFrameworkCssLoaderTs,
  generateShimBarrelFiles,
} from '../lib/generate-shims';
import { writeGeneratedFile, getRootDir } from './cli-utils';

const ROOT_DIR = getRootDir(import.meta.url);
const WEBVIEW_SRC_DIR = path.join(ROOT_DIR, 'packages/webview-client/src');

function main(): void {
  console.log('Generating shim barrels & framework CSS loader...');

  const cssLoader = generateFrameworkCssLoaderTs({
    webviewSrcDir: WEBVIEW_SRC_DIR,
  });
  writeGeneratedFile(cssLoader.outputPath, cssLoader.content);

  const barrels = generateShimBarrelFiles({
    webviewSrcDir: WEBVIEW_SRC_DIR,
  });

  for (const file of barrels) {
    writeGeneratedFile(file.outputPath, file.content);
  }

  console.log('Done.');
}

main();
