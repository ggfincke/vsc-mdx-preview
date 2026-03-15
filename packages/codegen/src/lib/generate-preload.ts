// packages/codegen/src/lib/generate-preload.ts
// code generation for webview preload & alias tables

import * as path from 'path';
import {
  COMPONENT_REGISTRY,
  SHIM_PREFIX,
  type ComponentDefinition,
  type ComponentRegistryEntry,
  type FrameworkId,
} from 'mdx-forge/components/registry';
import { isBareImport } from '@mdx-preview/runtime-utils';
import { normalizeImportPath, createGeneratedHeader } from './codegen-utils';
import { buildPreloadId, buildWebviewImport } from './registry-host-metadata';

const GENERATED_HEADER = createGeneratedHeader(
  'packages/mdx-forge/src/components/registry/registry-data.ts'
);

export interface GeneratePreloadOptions {
  outputDir: string;
  webviewSrcDir: string;
}

const REGISTRY_ENTRIES: readonly ComponentRegistryEntry[] = COMPONENT_REGISTRY;

// frameworks that have lazy-loaded shims (excludes 'generic')
const LAZY_FRAMEWORKS: FrameworkId[] = [
  'docusaurus',
  'starlight',
  'nextra',
  'nextjs',
];

function isComponentEntry(
  entry: ComponentRegistryEntry
): entry is ComponentDefinition {
  return entry.kind === 'component';
}

function getRelativeWebviewImport(
  entry: ComponentRegistryEntry,
  options: GeneratePreloadOptions
): string {
  const webviewImport = buildWebviewImport(entry);

  // framework shims now come from the extracted doc-components library
  if (webviewImport.startsWith('features/shims/')) {
    return `mdx-forge/components/${entry.framework}`;
  }

  // bare package imports should pass through untouched
  if (isBareImport(webviewImport)) {
    return webviewImport;
  }

  const absoluteTarget = path.resolve(options.webviewSrcDir, webviewImport);
  const relative = path.relative(options.outputDir, absoluteTarget);
  return normalizeImportPath(relative);
}

function toImportVarName(entry: ComponentRegistryEntry): string {
  const framework = entry.framework.replace(/[^a-zA-Z0-9]/g, '_');
  const name = entry.name.replace(/[^a-zA-Z0-9]/g, '_');
  return `${framework}_${name}`;
}

function getComponentExportNames(entry: ComponentDefinition): string[] {
  const exportNames = new Set<string>();
  exportNames.add(entry.name);

  if (entry.framework === 'generic') {
    for (const alias of entry.aliases) {
      exportNames.add(alias);
    }
  }

  return Array.from(exportNames);
}

function getImportStatement(
  entry: ComponentRegistryEntry,
  importVar: string,
  relativeImport: string
): string {
  if (
    entry.kind === 'component' &&
    relativeImport.startsWith('mdx-forge/components/')
  ) {
    const importName = entry.importName ?? entry.name;
    return `import { ${importName} as ${importVar} } from '${relativeImport}';`;
  }

  if (entry.kind === 'barrel') {
    return `import * as ${importVar} from '${relativeImport}';`;
  }

  if (entry.importKind === 'named') {
    const importName = entry.importName ?? entry.name;
    return `import { ${importName} as ${importVar} } from '${relativeImport}';`;
  }

  return `import ${importVar} from '${relativeImport}';`;
}

function getDynamicImportExpression(
  entry: ComponentRegistryEntry,
  relativeImport: string
): string {
  if (
    entry.kind === 'component' &&
    relativeImport.startsWith('mdx-forge/components/')
  ) {
    const importName = entry.importName ?? entry.name;
    return `import('${relativeImport}').then(m => m.${importName})`;
  }

  if (entry.kind === 'barrel') {
    return `import('${relativeImport}')`;
  }

  if (entry.importKind === 'named') {
    const importName = entry.importName ?? entry.name;
    return `import('${relativeImport}').then(m => m.${importName})`;
  }

  return `import('${relativeImport}').then(m => m.default)`;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function groupEntriesByFramework(
  entries: readonly ComponentRegistryEntry[]
): Map<FrameworkId, ComponentRegistryEntry[]> {
  const grouped = new Map<FrameworkId, ComponentRegistryEntry[]>();

  for (const entry of entries) {
    const existing = grouped.get(entry.framework) ?? [];
    existing.push(entry);
    grouped.set(entry.framework, existing);
  }

  return grouped;
}

function generateGenericPreloadFunction(
  entries: ComponentRegistryEntry[],
  options: GeneratePreloadOptions,
  aliasesByPreloadId: Readonly<Record<string, readonly string[]>>
): { imports: string[]; func: string; loaders: string } {
  const importLines: string[] = [];
  const preloadLines: string[] = [];
  const loaderEntries: string[] = [];

  for (const entry of entries) {
    const importVar = toImportVarName(entry);
    const relativeImport = getRelativeWebviewImport(entry, options);
    importLines.push(getImportStatement(entry, importVar, relativeImport));
    const aliases = aliasesByPreloadId[buildPreloadId(entry)] ?? [];
    const aliasesJson = JSON.stringify(aliases);

    if (isComponentEntry(entry)) {
      const exportNames = getComponentExportNames(entry);
      const exportNamesJson = JSON.stringify(exportNames);
      preloadLines.push(
        `  preloadEntry(registry, { id: '${buildPreloadId(entry)}', exports: createComponentModule(${importVar}, ${exportNamesJson}), aliases: ${aliasesJson} });`
      );

      const loaderExpression = relativeImport.startsWith(
        'mdx-forge/components/'
      )
        ? `import('${relativeImport}').then(m => m.${entry.importName ?? entry.name})`
        : `import('${relativeImport}').then(m => m.default)`;

      // generate individual lazy loader for conditional preloading
      loaderEntries.push(
        `  '${entry.name}': async (registry: ModuleRegistry) => {
    const component = await ${loaderExpression};
    preloadEntry(registry, { id: '${buildPreloadId(entry)}', exports: createComponentModule(component, ${exportNamesJson}), aliases: ${aliasesJson} });
  }`
      );
    } else {
      preloadLines.push(
        `  preloadEntry(registry, { id: '${buildPreloadId(entry)}', exports: createBarrelModule(${importVar}, ${JSON.stringify(
          entry.exportNames
        )}), aliases: ${aliasesJson} });`
      );
    }
  }

  const func = `// preload generic shims synchronously
export function preloadGenericShims(registry: ModuleRegistry): void {
${preloadLines.join('\n')}
}`;

  const loaders = `// individual lazy loaders for conditional generic shim preloading
export const GENERIC_SHIM_LOADERS: Record<string, (registry: ModuleRegistry) => Promise<void>> = {
${loaderEntries.join(',\n')}
};`;

  return { imports: importLines, func, loaders };
}

function generateFrameworkLoader(
  framework: FrameworkId,
  entries: ComponentRegistryEntry[],
  options: GeneratePreloadOptions,
  aliasesByPreloadId: Readonly<Record<string, readonly string[]>>
): string {
  const funcName = `load${capitalize(framework)}Shims`;

  // build dynamic import promises
  const importPromises: string[] = [];
  const varNames: string[] = [];

  for (const entry of entries) {
    const varName = toImportVarName(entry);
    const relativeImport = getRelativeWebviewImport(entry, options);
    const dynamicImport = getDynamicImportExpression(entry, relativeImport);
    importPromises.push(`    ${dynamicImport}`);
    varNames.push(varName);
  }

  // build preload calls
  const preloadCalls: string[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const varName = varNames[i];
    const aliases = aliasesByPreloadId[buildPreloadId(entry)] ?? [];
    const aliasesJson = JSON.stringify(aliases);

    if (isComponentEntry(entry)) {
      const exportNames = getComponentExportNames(entry);
      preloadCalls.push(
        `  preloadEntry(registry, { id: '${buildPreloadId(entry)}', exports: createComponentModule(${varName}, ${JSON.stringify(
          exportNames
        )}), aliases: ${aliasesJson} });`
      );
    } else {
      preloadCalls.push(
        `  preloadEntry(registry, { id: '${buildPreloadId(entry)}', exports: createBarrelModule(${varName}, ${JSON.stringify(
          entry.exportNames
        )}), aliases: ${aliasesJson} });`
      );
    }
  }

  return `// lazy-load ${framework} shims on demand
export async function ${funcName}(registry: ModuleRegistry): Promise<void> {
  const [
    ${varNames.join(',\n    ')}
  ] = await Promise.all([
${importPromises.join(',\n')}
  ]);

${preloadCalls.join('\n')}
}`;
}

export function generatePreloadTs(options: GeneratePreloadOptions): string {
  const grouped = groupEntriesByFramework(REGISTRY_ENTRIES);
  const { aliases: shimAliases } = buildShimAliases();
  const aliasesByPreloadId = buildAliasesByPreloadId(shimAliases);
  const moduleRegistryImport = 'mdx-forge/browser/registry';
  const preloadCoreImport = normalizeImportPath(
    path.relative(
      options.outputDir,
      path.resolve(
        options.webviewSrcDir,
        'features/module-runtime/preload/core'
      )
    )
  );

  // generate generic shims (static imports + lazy loaders)
  const genericEntries = grouped.get('generic') ?? [];
  const {
    imports: genericImports,
    func: genericFunc,
    loaders: genericLoaders,
  } = generateGenericPreloadFunction(
    genericEntries,
    options,
    aliasesByPreloadId
  );

  // generate framework loaders (dynamic imports)
  const frameworkLoaders: string[] = [];
  for (const framework of LAZY_FRAMEWORKS) {
    const entries = grouped.get(framework) ?? [];
    if (entries.length > 0) {
      frameworkLoaders.push(
        generateFrameworkLoader(framework, entries, options, aliasesByPreloadId)
      );
    }
  }

  // generate FRAMEWORK_LOADERS map (includes generic as no-op since it's loaded synchronously)
  const loaderMapEntries = [
    // generic shims are loaded synchronously via preloadGenericShims
    '  generic: async () => {}',
    ...LAZY_FRAMEWORKS.map((fw) => `  ${fw}: load${capitalize(fw)}Shims`),
  ];

  return `${GENERATED_HEADER}
import type { ModuleRegistry } from '${moduleRegistryImport}';
import { createBarrelModule, createComponentModule, preloadEntry } from '${preloadCoreImport}';
import type { FrameworkId } from '@mdx-preview/contracts';

// static imports for generic shims
${genericImports.join('\n')}

${genericFunc}

${genericLoaders}

${frameworkLoaders.join('\n\n')}

// map framework name to lazy loader function
// note: 'generic' is a no-op since generic shims are loaded synchronously via preloadGenericShims
export const FRAMEWORK_LOADERS: Record<FrameworkId, (registry: ModuleRegistry) => Promise<void>> = {
${loaderMapEntries.join(',\n')}
};
`;
}

function setAlias(
  aliases: Record<string, string>,
  key: string,
  value: string
): void {
  const existing = aliases[key];
  if (existing && existing !== value) {
    throw new Error(`Alias collision for "${key}": ${existing} vs ${value}`);
  }
  aliases[key] = value;
}

function buildShimAliases(): {
  aliases: Record<string, string>;
  preloadIds: string[];
} {
  const aliases: Record<string, string> = {};
  const preloadIds: string[] = [];
  const seenPreloadIds = new Set<string>();

  for (const entry of REGISTRY_ENTRIES) {
    if (!seenPreloadIds.has(buildPreloadId(entry))) {
      seenPreloadIds.add(buildPreloadId(entry));
      preloadIds.push(buildPreloadId(entry));
    }

    for (const specifier of entry.importSpecifiers) {
      setAlias(aliases, specifier, buildPreloadId(entry));
    }

    setAlias(aliases, entry.shimPath, buildPreloadId(entry));

    if (isComponentEntry(entry) && entry.exposeAsBareImport) {
      setAlias(aliases, entry.name, buildPreloadId(entry));
      for (const alias of entry.aliases) {
        setAlias(aliases, alias, buildPreloadId(entry));
        setAlias(
          aliases,
          `${SHIM_PREFIX}/generic/${alias}`,
          buildPreloadId(entry)
        );
      }
    }
  }

  return { aliases, preloadIds };
}

function buildAliasesByPreloadId(
  aliases: Readonly<Record<string, string>>
): Record<string, string[]> {
  const byPreloadId: Record<string, string[]> = {};

  for (const [alias, preloadId] of Object.entries(aliases)) {
    const existing = byPreloadId[preloadId];
    if (existing) {
      existing.push(alias);
    } else {
      byPreloadId[preloadId] = [alias];
    }
  }

  for (const preloadId of Object.keys(byPreloadId)) {
    byPreloadId[preloadId].sort();
  }

  return byPreloadId;
}

export function generatePreloadAliasesTs(): string {
  const { preloadIds } = buildShimAliases();

  return `${GENERATED_HEADER}
// canonical shim preload IDs (used for cache resets)
export const PRELOADED_SHIM_IDS: string[] = ${JSON.stringify(preloadIds, null, 2)};
`;
}
