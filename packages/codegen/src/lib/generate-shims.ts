// packages/codegen/src/lib/generate-shims.ts
// generate shim barrels & framework CSS loader

import * as path from 'path';
import {
  FRAMEWORK_CSS_CONFIG,
  SHIM_BARREL_CONFIG,
} from '@mdx-preview/registry';

const GENERATED_HEADER = `// AUTO-GENERATED FILE - DO NOT EDIT\n// Source: packages/registry/src/shims/shim-config.ts\n`;

export interface GenerateShimsOptions {
  webviewSrcDir: string;
}

export interface GeneratedFile {
  outputPath: string;
  content: string;
}

function normalizeImportPath(filePath: string): string {
  const withSlashes = filePath.replace(/\\/g, '/');
  if (withSlashes.startsWith('.')) {
    return withSlashes;
  }
  return `./${withSlashes}`;
}

function buildRelativeImport(fromDir: string, targetPath: string): string {
  const relative = path.relative(fromDir, targetPath);
  return normalizeImportPath(relative);
}

function remapShimImportPath(
  outputPath: string,
  importPath: string
): string {
  if (!importPath.startsWith('./')) {
    return importPath;
  }

  const segments = outputPath.replace(/\\/g, '/').split('/');
  if (
    segments.length < 4 ||
    segments[0] !== 'generated' ||
    segments[1] !== 'shim-barrels'
  ) {
    return importPath;
  }

  const framework = segments[2];
  const suffix = importPath.slice(2);
  return `../../../features/shims/${framework}/${suffix}`;
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

    for (const exportEntry of entry.exports) {
      const remappedFrom = remapShimImportPath(entry.outputPath, exportEntry.from);

      if (exportEntry.values && exportEntry.values.length > 0) {
        fileLines.push(
          `export { ${exportEntry.values.join(', ')} } from '${remappedFrom}';`
        );
      }

      if (exportEntry.types && exportEntry.types.length > 0) {
        fileLines.push(
          `export type { ${exportEntry.types.join(', ')} } from '${remappedFrom}';`
        );
      }

      fileLines.push('');
    }

    if (entry.sideEffectImports && entry.sideEffectImports.length > 0) {
      for (const sideEffect of entry.sideEffectImports) {
        const remappedImport = remapShimImportPath(entry.outputPath, sideEffect);
        fileLines.push(`import '${remappedImport}';`);
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
      const absoluteCss = path.resolve(options.webviewSrcDir, entry.cssImport);
      const relativeCss = buildRelativeImport(outputDir, absoluteCss);
      loaderLines.push(`  ${entry.framework}: createResourceLoader(`);
      loaderLines.push(
        `    () => import('${relativeCss}').then(() => undefined),`
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
