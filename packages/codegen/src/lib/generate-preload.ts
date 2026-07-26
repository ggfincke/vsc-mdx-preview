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
import { normalizeImportPath, createGeneratedHeader } from './codegen-utils';
import { buildPreloadId } from './registry-host-metadata';

const GENERATED_HEADER = createGeneratedHeader(
  'mdx-forge/src/components/registry/registry-data.ts'
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

function getRelativeWebviewImport(entry: ComponentRegistryEntry): string {
  return `mdx-forge/components/${entry.framework}`;
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

type ImportBinding =
  | { form: 'namespace' }
  | { form: 'named'; importName: string }
  | { form: 'default' };

// classify how an entry binds to its module, shared by static & dynamic forms
function getImportBinding(
  entry: ComponentRegistryEntry,
  relativeImport: string
): ImportBinding {
  if (entry.kind === 'barrel') {
    return { form: 'namespace' };
  }

  if (
    relativeImport.startsWith('mdx-forge/components/') ||
    entry.importKind === 'named'
  ) {
    return { form: 'named', importName: entry.importName ?? entry.name };
  }

  return { form: 'default' };
}

function getImportStatement(
  entry: ComponentRegistryEntry,
  importVar: string,
  relativeImport: string
): string {
  const binding = getImportBinding(entry, relativeImport);

  if (binding.form === 'namespace') {
    return `import * as ${importVar} from '${relativeImport}';`;
  }

  if (binding.form === 'named') {
    return `import { ${binding.importName} as ${importVar} } from '${relativeImport}';`;
  }

  return `import ${importVar} from '${relativeImport}';`;
}

function getDynamicImportExpression(
  entry: ComponentRegistryEntry,
  relativeImport: string
): string {
  const binding = getImportBinding(entry, relativeImport);

  if (binding.form === 'namespace') {
    return `import('${relativeImport}')`;
  }

  if (binding.form === 'named') {
    return `import('${relativeImport}').then(m => m.${binding.importName})`;
  }

  return `import('${relativeImport}').then(m => m.default)`;
}

// build the unindented preloadEntry call text shared by all generators
function buildPreloadCall(
  entry: ComponentRegistryEntry,
  varName: string,
  aliasesJson: string
): string {
  const exports = isComponentEntry(entry)
    ? `createComponentModule(${varName}, ${JSON.stringify(getComponentExportNames(entry))})`
    : `createBarrelModule(${varName}, ${JSON.stringify(entry.exportNames)})`;
  return `preloadEntry(registry, { id: '${buildPreloadId(entry)}', exports: ${exports}, aliases: ${aliasesJson} });`;
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
  aliasesByPreloadId: Readonly<Record<string, readonly string[]>>
): { imports: string[]; func: string; loaders: string } {
  const importLines: string[] = [];
  const preloadLines: string[] = [];
  const loaderEntries: string[] = [];

  for (const entry of entries) {
    const importVar = toImportVarName(entry);
    const relativeImport = getRelativeWebviewImport(entry);
    importLines.push(getImportStatement(entry, importVar, relativeImport));
    const aliases = aliasesByPreloadId[buildPreloadId(entry)] ?? [];
    const aliasesJson = JSON.stringify(aliases);
    const preloadCall = buildPreloadCall(entry, importVar, aliasesJson);
    preloadLines.push(`  ${preloadCall}`);

    if (isComponentEntry(entry)) {
      // register conditionally using static generic imports
      loaderEntries.push(
        `  '${entry.name}': async (registry: ModuleRegistry) => {
    ${preloadCall}
  }`
      );
    }
  }

  const func = `// preload generic shims synchronously
export function preloadGenericShims(registry: ModuleRegistry): void {
${preloadLines.join('\n')}
}`;

  const loaders = `// conditional generic shim preloaders
export const GENERIC_SHIM_LOADERS: Record<string, (registry: ModuleRegistry) => Promise<void>> = {
${loaderEntries.join(',\n')}
};`;

  return { imports: importLines, func, loaders };
}

function generateFrameworkLoader(
  framework: FrameworkId,
  entries: ComponentRegistryEntry[],
  aliasesByPreloadId: Readonly<Record<string, readonly string[]>>
): string {
  const funcName = `load${capitalize(framework)}Shims`;

  // build dynamic import promises
  const importPromises: string[] = [];
  const varNames: string[] = [];

  for (const entry of entries) {
    const varName = toImportVarName(entry);
    const relativeImport = getRelativeWebviewImport(entry);
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
    preloadCalls.push(`  ${buildPreloadCall(entry, varName, aliasesJson)}`);
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
  } = generateGenericPreloadFunction(genericEntries, aliasesByPreloadId);

  // generate framework loaders (dynamic imports)
  const frameworkLoaders: string[] = [];
  for (const framework of LAZY_FRAMEWORKS) {
    const entries = grouped.get(framework) ?? [];
    if (entries.length > 0) {
      frameworkLoaders.push(
        generateFrameworkLoader(framework, entries, aliasesByPreloadId)
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
    const preloadId = buildPreloadId(entry);
    if (!seenPreloadIds.has(preloadId)) {
      seenPreloadIds.add(preloadId);
      preloadIds.push(preloadId);
    }

    for (const specifier of entry.importSpecifiers) {
      setAlias(aliases, specifier, preloadId);
    }

    setAlias(aliases, entry.shimPath, preloadId);

    if (isComponentEntry(entry) && entry.exposeAsBareImport) {
      setAlias(aliases, entry.name, preloadId);
      for (const alias of entry.aliases) {
        setAlias(aliases, alias, preloadId);
        setAlias(aliases, `${SHIM_PREFIX}/generic/${alias}`, preloadId);
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
