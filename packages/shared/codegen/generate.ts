// packages/shared/codegen/generate.ts
// code generation for webview preload and alias tables

import * as path from 'path';
import {
  COMPONENT_REGISTRY,
  SHIM_PREFIX,
  type ComponentDefinition,
  type ComponentRegistryEntry,
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

export function generatePreloadTs(options: GeneratePreloadOptions): string {
  const importLines: string[] = [];
  const preloadLines: string[] = [];

  for (const entry of REGISTRY_ENTRIES) {
    const importVar = toImportVarName(entry);
    const relativeImport = getRelativeWebviewImport(entry, options);
    importLines.push(getImportStatement(entry, importVar, relativeImport));

    if (isComponentEntry(entry)) {
      const exportNames = getComponentExportNames(entry);
      preloadLines.push(
        `  registry.preload('${entry.preloadId}', createComponentModule(${importVar}, ${JSON.stringify(
          exportNames
        )}));`
      );
    } else {
      preloadLines.push(
        `  registry.preload('${entry.preloadId}', createBarrelModule(${importVar}, ${JSON.stringify(
          entry.exportNames
        )}));`
      );
    }
  }

  return `${GENERATED_HEADER}
import type { ModuleRegistry } from '../registry/ModuleRegistry';
import { createBarrelModule, createComponentModule } from './core';

${importLines.join('\n')}

// preload all shim components into the module registry
export function preloadAllShims(registry: ModuleRegistry): void {
${preloadLines.join('\n')}
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
