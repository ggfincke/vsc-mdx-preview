// packages/shared/codegen/generate.ts
// code generation for webview preload & alias tables

import * as path from 'path';
import {
  COMPONENT_REGISTRY,
  SHIM_PREFIX,
  type ComponentDefinition,
  type ComponentRegistryEntry,
  type Framework,
  type FrameworkId,
} from '../registry/components';
import { PRELOADED_MODULE_IDS } from '../core-modules';

const GENERATED_HEADER = `// AUTO-GENERATED FILE - DO NOT EDIT
// Source: packages/shared/registry/components.ts
`;

export interface GeneratePreloadOptions {
  outputDir: string;
  webviewSrcDir: string;
}

const REGISTRY_ENTRIES: readonly ComponentRegistryEntry[] = COMPONENT_REGISTRY;

// frameworks that have lazy-loaded shims (excludes 'generic')
const LAZY_FRAMEWORKS: Framework[] = [
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

function normalizeImportPath(filePath: string): string {
  const withSlashes = filePath.replace(/\\/g, '/');
  if (withSlashes.startsWith('.')) {
    return withSlashes;
  }
  return `./${withSlashes}`;
}

function getRelativeWebviewImport(
  entry: ComponentRegistryEntry,
  options: GeneratePreloadOptions
): string {
  const absoluteTarget = path.resolve(options.webviewSrcDir, entry.webviewImport);
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
  options: GeneratePreloadOptions
): { imports: string[]; func: string; loaders: string } {
  const importLines: string[] = [];
  const preloadLines: string[] = [];
  const loaderEntries: string[] = [];

  for (const entry of entries) {
    const importVar = toImportVarName(entry);
    const relativeImport = getRelativeWebviewImport(entry, options);
    importLines.push(getImportStatement(entry, importVar, relativeImport));

    if (isComponentEntry(entry)) {
      const exportNames = getComponentExportNames(entry);
      const exportNamesJson = JSON.stringify(exportNames);
      preloadLines.push(
        `  registry.preload('${entry.preloadId}', createComponentModule(${importVar}, ${exportNamesJson}));`
      );

      // Generate individual lazy loader for conditional preloading
      loaderEntries.push(
        `  '${entry.name}': async (registry: ModuleRegistry) => {
    const component = await import('${relativeImport}').then(m => m.default);
    registry.preload('${entry.preloadId}', createComponentModule(component, ${exportNamesJson}));
  }`
      );
    } else {
      preloadLines.push(
        `  registry.preload('${entry.preloadId}', createBarrelModule(${importVar}, ${JSON.stringify(
          entry.exportNames
        )}));`
      );
    }
  }

  const func = `// preload generic shims synchronously (for backward compatibility)
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
  framework: Framework,
  entries: ComponentRegistryEntry[],
  options: GeneratePreloadOptions
): string {
  const funcName = `load${capitalize(framework)}Shims`;

  // generate dynamic import promises
  const importPromises: string[] = [];
  const varNames: string[] = [];

  for (const entry of entries) {
    const varName = toImportVarName(entry);
    const relativeImport = getRelativeWebviewImport(entry, options);
    const dynamicImport = getDynamicImportExpression(entry, relativeImport);
    importPromises.push(`    ${dynamicImport}`);
    varNames.push(varName);
  }

  // generate preload calls
  const preloadCalls: string[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const varName = varNames[i];

    if (isComponentEntry(entry)) {
      const exportNames = getComponentExportNames(entry);
      preloadCalls.push(
        `  registry.preload('${entry.preloadId}', createComponentModule(${varName}, ${JSON.stringify(
          exportNames
        )}));`
      );
    } else {
      preloadCalls.push(
        `  registry.preload('${entry.preloadId}', createBarrelModule(${varName}, ${JSON.stringify(
          entry.exportNames
        )}));`
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

  // generate generic shims (static imports + lazy loaders)
  const genericEntries = grouped.get('generic') ?? [];
  const { imports: genericImports, func: genericFunc, loaders: genericLoaders } =
    generateGenericPreloadFunction(genericEntries, options);

  // generate framework loaders (dynamic imports)
  const frameworkLoaders: string[] = [];
  for (const framework of LAZY_FRAMEWORKS) {
    const entries = grouped.get(framework) ?? [];
    if (entries.length > 0) {
      frameworkLoaders.push(generateFrameworkLoader(framework, entries, options));
    }
  }

  // generate FRAMEWORK_LOADERS map (includes generic as no-op since it's loaded synchronously)
  const loaderMapEntries = [
    '  generic: async () => {}', // generic shims loaded synchronously via preloadGenericShims
    ...LAZY_FRAMEWORKS.map((fw) => `  ${fw}: load${capitalize(fw)}Shims`),
  ];

  return `${GENERATED_HEADER}
import type { ModuleRegistry } from '../registry/ModuleRegistry';
import { createBarrelModule, createComponentModule } from './core';
import type { Framework } from '@mdx-preview/shared';

// static imports for generic shims (for backward compatibility)
${genericImports.join('\n')}

${genericFunc}

${genericLoaders}

${frameworkLoaders.join('\n\n')}

// map framework name to lazy loader function
// note: 'generic' is a no-op since generic shims are loaded synchronously via preloadGenericShims
export const FRAMEWORK_LOADERS: Record<Framework, (registry: ModuleRegistry) => Promise<void>> = {
${loaderMapEntries.join(',\n')}
};

// preload all shims (for backward compatibility during migration)
export async function preloadAllShims(registry: ModuleRegistry): Promise<void> {
  preloadGenericShims(registry);
  await Promise.all(
    Object.values(FRAMEWORK_LOADERS).map((loader) => loader(registry))
  );
}
`;
}

function setAlias(
  aliases: Record<string, string>,
  key: string,
  value: string
): void {
  const existing = aliases[key];
  if (existing && existing !== value) {
    throw new Error(
      `Alias collision for "${key}": ${existing} vs ${value}`
    );
  }
  aliases[key] = value;
}

function buildCoreAliases(): Record<string, string> {
  return {
    // React core aliases
    react: PRELOADED_MODULE_IDS.react,
    'npm://react': PRELOADED_MODULE_IDS.react,
    'react-dom': PRELOADED_MODULE_IDS.reactDom,
    'npm://react-dom': PRELOADED_MODULE_IDS.reactDom,
    'react-dom/client': PRELOADED_MODULE_IDS.reactDomClient,
    'npm://react-dom/client': PRELOADED_MODULE_IDS.reactDomClient,
    'react/jsx-runtime': PRELOADED_MODULE_IDS.jsxRuntime,
    'npm://react/jsx-runtime': PRELOADED_MODULE_IDS.jsxRuntime,

    // MDX aliases
    '@mdx-js/react': PRELOADED_MODULE_IDS.mdxReact,
    'npm://@mdx-js/react': PRELOADED_MODULE_IDS.mdxReact,

    // Layout aliases
    'vscode-markdown-layout': PRELOADED_MODULE_IDS.vscodeLayout,
    'npm://vscode-markdown-layout': PRELOADED_MODULE_IDS.vscodeLayout,
  };
}

function buildShimAliases(): {
  aliases: Record<string, string>;
  preloadIds: string[];
} {
  const aliases: Record<string, string> = {};
  const preloadIds: string[] = [];
  const seenPreloadIds = new Set<string>();

  for (const entry of REGISTRY_ENTRIES) {
    if (!seenPreloadIds.has(entry.preloadId)) {
      seenPreloadIds.add(entry.preloadId);
      preloadIds.push(entry.preloadId);
    }

    for (const specifier of entry.importSpecifiers) {
      setAlias(aliases, specifier, entry.preloadId);
    }

    setAlias(aliases, entry.shimPath, entry.preloadId);

    if (isComponentEntry(entry) && entry.exposeAsBareImport) {
      setAlias(aliases, entry.name, entry.preloadId);
      for (const alias of entry.aliases) {
        setAlias(aliases, alias, entry.preloadId);
        setAlias(aliases, `${SHIM_PREFIX}/generic/${alias}`, entry.preloadId);
      }
    }
  }

  return { aliases, preloadIds };
}

export function generatePreloadAliasesTs(): string {
  const { aliases: shimAliases, preloadIds } = buildShimAliases();
  const coreAliases = buildCoreAliases();
  const allAliases = { ...shimAliases, ...coreAliases };

  return `${GENERATED_HEADER}
// maps import specifiers to preload IDs
export const PRELOAD_ALIASES: Record<string, string> = ${JSON.stringify(
    allAliases,
    null,
    2
  )};

// canonical shim preload IDs (used for cache resets)
export const PRELOADED_SHIM_IDS: string[] = ${JSON.stringify(preloadIds, null, 2)};
`;
}
