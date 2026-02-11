// packages/codegen/src/lib/generate-shims.ts
// generate shim barrels & framework CSS loader

import * as path from 'path';
import {
  FRAMEWORK_CSS_CONFIG,
  SHIM_BARREL_CONFIG,
} from 'mdx-forge/components/registry';
import { isBareImport } from '@mdx-preview/runtime-utils';
import { normalizeImportPath, createGeneratedHeader } from './codegen-utils';

const GENERATED_HEADER = createGeneratedHeader(
  'packages/mdx-forge/src/components/registry/shim-config.ts'
);

export interface GenerateShimsOptions {
  webviewSrcDir: string;
}

export interface GeneratedFile {
  outputPath: string;
  content: string;
}

function buildRelativeImport(fromDir: string, targetPath: string): string {
  const relative = path.relative(fromDir, targetPath);
  return normalizeImportPath(relative);
}

function getFrameworkFromOutputPath(outputPath: string): string {
  const segments = outputPath.replace(/\\/g, '/').split('/');
  if (
    segments.length >= 3 &&
    segments[0] === 'generated' &&
    segments[1] === 'shim-barrels'
  ) {
    return segments[2];
  }

  return 'generic';
}

export function generateShimBarrelFiles(
  options: GenerateShimsOptions
): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  for (const entry of SHIM_BARREL_CONFIG) {
    const fileLines: string[] = [];

    fileLines.push(GENERATED_HEADER.trimEnd());
    fileLines.push(`// ${entry.outputPath}`);
    fileLines.push('');

    const framework = getFrameworkFromOutputPath(entry.outputPath);
    const frameworkImport = `mdx-forge/components/${framework}`;

    for (const exportEntry of entry.exports) {
      if (exportEntry.values && exportEntry.values.length > 0) {
        fileLines.push(
          `export { ${exportEntry.values.join(', ')} } from '${frameworkImport}';`
        );
      }

      if (exportEntry.types && exportEntry.types.length > 0) {
        fileLines.push(
          `export type { ${exportEntry.types.join(', ')} } from '${frameworkImport}';`
        );
      }

      fileLines.push('');
    }

    if (entry.sideEffectImports && entry.sideEffectImports.length > 0) {
      for (const sideEffect of entry.sideEffectImports) {
        if (sideEffect.endsWith('.css')) {
          fileLines.push(
            `import 'mdx-forge/components/styles/${framework}.css';`
          );
          continue;
        }

        fileLines.push(`import '${frameworkImport}';`);
      }
      fileLines.push('');
    }

    const content = fileLines.join('\n').trimEnd() + '\n';
    const outputPath = path.join(options.webviewSrcDir, entry.outputPath);
    files.push({ outputPath, content });
  }

  return files;
}

export function generateFrameworkCssLoaderTs(
  options: GenerateShimsOptions
): GeneratedFile {
  const outputPath = path.join(
    options.webviewSrcDir,
    'generated',
    'framework-css',
    'frameworkCssLoader.ts'
  );
  const outputDir = path.dirname(outputPath);
  const resourceLoaderImport = buildRelativeImport(
    outputDir,
    path.resolve(options.webviewSrcDir, 'shared/utils/createResourceLoader')
  );
  const loaderLines: string[] = [];
  loaderLines.push(GENERATED_HEADER.trimEnd());
  loaderLines.push(
    '// packages/webview-client/src/generated/framework-css/frameworkCssLoader.ts'
  );
  loaderLines.push(
    '// load framework CSS only when that framework shims are used'
  );
  loaderLines.push('');
  loaderLines.push(
    "import type { FrameworkId } from '@mdx-preview/contracts';"
  );
  loaderLines.push(
    `import { createResourceLoader, type ResourceLoader } from '${resourceLoaderImport}';`
  );
  loaderLines.push('');
  loaderLines.push('// create a loader for each framework');
  loaderLines.push('const loaders: Record<FrameworkId, ResourceLoader> = {');

  for (const entry of FRAMEWORK_CSS_CONFIG) {
    const loaderName = `${entry.framework}-css`;

    if (entry.cssImport) {
      const cssImport = isBareImport(entry.cssImport)
        ? entry.cssImport
        : buildRelativeImport(
            outputDir,
            path.resolve(options.webviewSrcDir, entry.cssImport)
          );
      loaderLines.push(`  ${entry.framework}: createResourceLoader(`);
      loaderLines.push(
        `    () => import('${cssImport}').then(() => undefined),`
      );
      loaderLines.push(
        `    { name: '${loaderName}', allowRetry: ${entry.allowRetry ? 'true' : 'false'} }`
      );
      loaderLines.push('  ),');
      continue;
    }

    loaderLines.push(
      `  ${entry.framework}: createResourceLoader(() => Promise.resolve(), { name: '${loaderName}', allowRetry: ${entry.allowRetry ? 'true' : 'false'} }),`
    );
  }

  loaderLines.push('};');
  loaderLines.push('');
  loaderLines.push('// load CSS for a specific framework');
  loaderLines.push(
    'export async function loadFrameworkCss(framework: FrameworkId): Promise<void> {'
  );
  loaderLines.push('  const loader = loaders[framework];');
  loaderLines.push('  if (loader) {');
  loaderLines.push('    return loader.load();');
  loaderLines.push('  }');
  loaderLines.push('}');
  loaderLines.push('');
  loaderLines.push('// check if CSS for a framework has been loaded');
  loaderLines.push(
    'export function isFrameworkCssLoaded(framework: FrameworkId): boolean {'
  );
  loaderLines.push('  const loader = loaders[framework];');
  loaderLines.push('  return loader ? loader.isLoaded() : false;');
  loaderLines.push('}');
  loaderLines.push('');
  loaderLines.push('// reset CSS loader state');
  loaderLines.push('export function resetFrameworkCssLoader(): void {');
  loaderLines.push('  for (const loader of Object.values(loaders)) {');
  loaderLines.push('    loader.reset();');
  loaderLines.push('  }');
  loaderLines.push('}');

  return { outputPath, content: loaderLines.join('\n') + '\n' };
}
