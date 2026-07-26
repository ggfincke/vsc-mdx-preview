// packages/codegen/src/cli/generate-shims.ts
// generate shim barrels & framework CSS loader

import * as path from 'path';
import {
  generateFrameworkCssLoaderTs,
  generateShimBarrelFiles,
} from '../lib/generate-shims';
import {
  assertGeneratedOutputPaths,
  getGeneratedOutputsForGenerator,
  loadGeneratedOutputManifest,
  resolveGeneratedOutputPath,
} from '../lib/generated-output-manifest';
import { writeGeneratedFile, getRootDir } from './cli-utils';

const ROOT_DIR = getRootDir(import.meta.url);
const WEBVIEW_SRC_DIR = path.join(ROOT_DIR, 'packages/webview-client/src');
const OUTPUT_MANIFEST = loadGeneratedOutputManifest(ROOT_DIR);

function main(): void {
  console.log('Generating shim barrels & framework CSS loader...');

  const cssLoader = generateFrameworkCssLoaderTs({
    webviewSrcDir: WEBVIEW_SRC_DIR,
  });

  const barrels = generateShimBarrelFiles({
    webviewSrcDir: WEBVIEW_SRC_DIR,
  });

  const generatedFiles = [cssLoader, ...barrels];
  const expectedOutputs = getGeneratedOutputsForGenerator(
    OUTPUT_MANIFEST,
    'shims'
  );
  assertGeneratedOutputPaths(
    ROOT_DIR,
    expectedOutputs,
    generatedFiles.map(({ outputPath }) => outputPath)
  );
  const generatedByPath = new Map(
    generatedFiles.map((file) => [path.normalize(file.outputPath), file])
  );

  for (const output of expectedOutputs) {
    const outputPath = resolveGeneratedOutputPath(ROOT_DIR, output);
    const generatedFile = generatedByPath.get(path.normalize(outputPath));
    if (!generatedFile) {
      throw new Error(`Missing generated shim output: ${output.path}`);
    }
    writeGeneratedFile(outputPath, generatedFile.content);
  }

  console.log('Done.');
}

main();
