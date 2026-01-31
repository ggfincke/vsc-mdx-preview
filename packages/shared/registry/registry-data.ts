// packages/shared/registry/registry-data.ts
// COMPONENT_REGISTRY data + derived types + builder functions
// NOTE: derived types (line 328+) use `typeof COMPONENT_REGISTRY` & MUST stay in this file

import {
  SHIM_PREFIX,
  type ComponentRegistryEntry,
  type Framework,
} from './types';

export const COMPONENT_REGISTRY = [
  // generic components (framework-agnostic)
  {
    kind: 'component',
    name: 'Callout',
    aliases: ['Alert', 'Admonition'],
    framework: 'generic',
    importSpecifiers: [],
    shimPath: `${SHIM_PREFIX}/generic/Callout`,
    preloadId: 'npm://@mdx-preview/shims-generic/Callout',
    webviewImport: 'components/shims/generic/Callout',
    exposeAsBareImport: true,
  },
  {
    kind: 'component',
    name: 'Collapsible',
    aliases: ['Accordion', 'Details'],
    framework: 'generic',
    importSpecifiers: [],
    shimPath: `${SHIM_PREFIX}/generic/Collapsible`,
    preloadId: 'npm://@mdx-preview/shims-generic/Collapsible',
    webviewImport: 'components/shims/generic/Collapsible',
    exposeAsBareImport: true,
  },
  {
    kind: 'component',
    name: 'Tabs',
    aliases: [],
    framework: 'generic',
    importSpecifiers: [],
    shimPath: `${SHIM_PREFIX}/generic/Tabs`,
    preloadId: 'npm://@mdx-preview/shims-generic/Tabs',
    webviewImport: 'components/shims/generic/Tabs',
    exposeAsBareImport: true,
  },
  {
    kind: 'component',
    name: 'TabItem',
    aliases: ['Tab'],
    framework: 'generic',
    importSpecifiers: [],
    shimPath: `${SHIM_PREFIX}/generic/TabItem`,
    preloadId: 'npm://@mdx-preview/shims-generic/TabItem',
    webviewImport: 'components/shims/generic/TabItem',
    exposeAsBareImport: true,
  },
  {
    kind: 'component',
    name: 'CodeGroup',
    aliases: [],
    framework: 'generic',
    importSpecifiers: [],
    shimPath: `${SHIM_PREFIX}/generic/CodeGroup`,
    preloadId: 'npm://@mdx-preview/shims-generic/CodeGroup',
    webviewImport: 'components/shims/generic/CodeGroup',
    exposeAsBareImport: true,
  },

  // Docusaurus components
  {
    kind: 'component',
    name: 'Tabs',
    aliases: [],
    framework: 'docusaurus',
    importSpecifiers: ['@theme/Tabs'],
    shimPath: `${SHIM_PREFIX}/docusaurus/Tabs`,
    preloadId: 'npm://@mdx-preview/shims-docusaurus/Tabs',
    webviewImport: 'components/shims/docusaurus/Tabs',
  },
  {
    kind: 'component',
    name: 'TabItem',
    aliases: [],
    framework: 'docusaurus',
    importSpecifiers: ['@theme/TabItem'],
    shimPath: `${SHIM_PREFIX}/docusaurus/TabItem`,
    preloadId: 'npm://@mdx-preview/shims-docusaurus/TabItem',
    webviewImport: 'components/shims/docusaurus/Tabs',
    importKind: 'named',
    importName: 'TabItem',
  },
  {
    kind: 'component',
    name: 'CodeBlock',
    aliases: [],
    framework: 'docusaurus',
    importSpecifiers: ['@theme/CodeBlock'],
    shimPath: `${SHIM_PREFIX}/docusaurus/CodeBlock`,
    preloadId: 'npm://@mdx-preview/shims-docusaurus/CodeBlock',
    webviewImport: 'components/shims/docusaurus/CodeBlock',
  },
  {
    kind: 'component',
    name: 'Details',
    aliases: [],
    framework: 'docusaurus',
    importSpecifiers: ['@theme/Details'],
    shimPath: `${SHIM_PREFIX}/docusaurus/Details`,
    preloadId: 'npm://@mdx-preview/shims-docusaurus/Details',
    webviewImport: 'components/shims/docusaurus/Details',
  },

  // Starlight components
  {
    kind: 'barrel',
    name: 'components',
    framework: 'starlight',
    importSpecifiers: ['@astrojs/starlight/components'],
    shimPath: `${SHIM_PREFIX}/starlight`,
    preloadId: 'npm://@mdx-preview/shims-starlight/components',
    webviewImport: 'components/shims/starlight',
    exportNames: [
      'Card',
      'CardGrid',
      'LinkCard',
      'Steps',
      'Badge',
      'Aside',
      'Tabs',
      'TabItem',
      'FileTree',
      'Code',
    ],
  },
  {
    kind: 'component',
    name: 'Card',
    aliases: [],
    framework: 'starlight',
    importSpecifiers: ['@astrojs/starlight/components/Card'],
    shimPath: `${SHIM_PREFIX}/starlight/Card`,
    preloadId: 'npm://@mdx-preview/shims-starlight/Card',
    webviewImport: 'components/shims/starlight/Card',
  },
  {
    kind: 'component',
    name: 'CardGrid',
    aliases: [],
    framework: 'starlight',
    importSpecifiers: ['@astrojs/starlight/components/CardGrid'],
    shimPath: `${SHIM_PREFIX}/starlight/CardGrid`,
    preloadId: 'npm://@mdx-preview/shims-starlight/CardGrid',
    webviewImport: 'components/shims/starlight/CardGrid',
  },
  {
    kind: 'component',
    name: 'LinkCard',
    aliases: [],
    framework: 'starlight',
    importSpecifiers: ['@astrojs/starlight/components/LinkCard'],
    shimPath: `${SHIM_PREFIX}/starlight/LinkCard`,
    preloadId: 'npm://@mdx-preview/shims-starlight/LinkCard',
    webviewImport: 'components/shims/starlight/LinkCard',
  },
  {
    kind: 'component',
    name: 'Steps',
    aliases: [],
    framework: 'starlight',
    importSpecifiers: ['@astrojs/starlight/components/Steps'],
    shimPath: `${SHIM_PREFIX}/starlight/Steps`,
    preloadId: 'npm://@mdx-preview/shims-starlight/Steps',
    webviewImport: 'components/shims/starlight/Steps',
  },
  {
    kind: 'component',
    name: 'Badge',
    aliases: [],
    framework: 'starlight',
    importSpecifiers: ['@astrojs/starlight/components/Badge'],
    shimPath: `${SHIM_PREFIX}/starlight/Badge`,
    preloadId: 'npm://@mdx-preview/shims-starlight/Badge',
    webviewImport: 'components/shims/starlight/Badge',
  },
  {
    kind: 'component',
    name: 'Aside',
    aliases: [],
    framework: 'starlight',
    importSpecifiers: ['@astrojs/starlight/components/Aside'],
    shimPath: `${SHIM_PREFIX}/starlight/Aside`,
    preloadId: 'npm://@mdx-preview/shims-starlight/Aside',
    webviewImport: 'components/shims/starlight/Aside',
  },
  {
    kind: 'component',
    name: 'Tabs',
    aliases: [],
    framework: 'starlight',
    importSpecifiers: ['@astrojs/starlight/components/Tabs'],
    shimPath: `${SHIM_PREFIX}/starlight/Tabs`,
    preloadId: 'npm://@mdx-preview/shims-starlight/Tabs',
    webviewImport: 'components/shims/starlight/Tabs',
    importKind: 'named',
    importName: 'Tabs',
  },
  {
    kind: 'component',
    name: 'TabItem',
    aliases: [],
    framework: 'starlight',
    importSpecifiers: ['@astrojs/starlight/components/TabItem'],
    shimPath: `${SHIM_PREFIX}/starlight/TabItem`,
    preloadId: 'npm://@mdx-preview/shims-starlight/TabItem',
    webviewImport: 'components/shims/starlight/Tabs',
    importKind: 'named',
    importName: 'TabItem',
  },
  {
    kind: 'component',
    name: 'FileTree',
    aliases: [],
    framework: 'starlight',
    importSpecifiers: ['@astrojs/starlight/components/FileTree'],
    shimPath: `${SHIM_PREFIX}/starlight/FileTree`,
    preloadId: 'npm://@mdx-preview/shims-starlight/FileTree',
    webviewImport: 'components/shims/starlight/FileTree',
  },
  {
    kind: 'component',
    name: 'Code',
    aliases: [],
    framework: 'starlight',
    importSpecifiers: ['@astrojs/starlight/components/Code'],
    shimPath: `${SHIM_PREFIX}/starlight/Code`,
    preloadId: 'npm://@mdx-preview/shims-starlight/Code',
    webviewImport: 'components/shims/starlight/Code',
  },

  // Next.js components
  {
    kind: 'component',
    name: 'Image',
    aliases: [],
    framework: 'nextjs',
    importSpecifiers: ['next/image'],
    shimPath: `${SHIM_PREFIX}/nextjs/Image`,
    preloadId: 'npm://@mdx-preview/shims-nextjs/Image',
    webviewImport: 'components/shims/nextjs/Image',
  },
  {
    kind: 'component',
    name: 'Link',
    aliases: [],
    framework: 'nextjs',
    importSpecifiers: ['next/link'],
    shimPath: `${SHIM_PREFIX}/nextjs/Link`,
    preloadId: 'npm://@mdx-preview/shims-nextjs/Link',
    webviewImport: 'components/shims/nextjs/Link',
  },

  // Nextra components
  {
    kind: 'barrel',
    name: 'components',
    framework: 'nextra',
    importSpecifiers: [
      'nextra/components',
      'nextra-theme-docs',
      'nextra-theme-docs/components',
    ],
    shimPath: `${SHIM_PREFIX}/nextra`,
    preloadId: 'npm://@mdx-preview/shims-nextra/components',
    webviewImport: 'components/shims/nextra',
    exportNames: ['Callout', 'Tabs', 'Cards', 'FileTree', 'Steps', 'Bleed'],
  },
  {
    kind: 'component',
    name: 'Callout',
    aliases: [],
    framework: 'nextra',
    importSpecifiers: ['nextra/components/Callout'],
    shimPath: `${SHIM_PREFIX}/nextra/Callout`,
    preloadId: 'npm://@mdx-preview/shims-nextra/Callout',
    webviewImport: 'components/shims/nextra/Callout',
  },
  {
    kind: 'component',
    name: 'Tabs',
    aliases: [],
    framework: 'nextra',
    importSpecifiers: ['nextra/components/Tabs'],
    shimPath: `${SHIM_PREFIX}/nextra/Tabs`,
    preloadId: 'npm://@mdx-preview/shims-nextra/Tabs',
    webviewImport: 'components/shims/nextra/Tabs',
  },
  {
    kind: 'component',
    name: 'Cards',
    aliases: [],
    framework: 'nextra',
    importSpecifiers: ['nextra/components/Cards'],
    shimPath: `${SHIM_PREFIX}/nextra/Cards`,
    preloadId: 'npm://@mdx-preview/shims-nextra/Cards',
    webviewImport: 'components/shims/nextra/Cards',
  },
  {
    kind: 'component',
    name: 'FileTree',
    aliases: [],
    framework: 'nextra',
    importSpecifiers: ['nextra/components/FileTree'],
    shimPath: `${SHIM_PREFIX}/nextra/FileTree`,
    preloadId: 'npm://@mdx-preview/shims-nextra/FileTree',
    webviewImport: 'components/shims/nextra/FileTree',
  },
  {
    kind: 'component',
    name: 'Steps',
    aliases: [],
    framework: 'nextra',
    importSpecifiers: ['nextra/components/Steps'],
    shimPath: `${SHIM_PREFIX}/nextra/Steps`,
    preloadId: 'npm://@mdx-preview/shims-nextra/Steps',
    webviewImport: 'components/shims/nextra/Steps',
  },
  {
    kind: 'component',
    name: 'Bleed',
    aliases: [],
    framework: 'nextra',
    importSpecifiers: ['nextra/components/Bleed'],
    shimPath: `${SHIM_PREFIX}/nextra/Bleed`,
    preloadId: 'npm://@mdx-preview/shims-nextra/Bleed',
    webviewImport: 'components/shims/nextra/Bleed',
  },
] as const satisfies readonly ComponentRegistryEntry[];

// derive types from the registry for stronger typing across the repo
// NOTE: derived types (line 328+) use `typeof COMPONENT_REGISTRY` & MUST stay in this file
export type ComponentRegistryEntryType = (typeof COMPONENT_REGISTRY)[number];

type GenericComponentEntry = Extract<
  ComponentRegistryEntryType,
  { kind: 'component'; framework: 'generic' }
>;

export type GenericComponentName = Extract<
  ComponentRegistryEntryType,
  { kind: 'component'; framework: 'generic' }
>['name'];

export type GenericComponentAlias = Extract<
  ComponentRegistryEntryType,
  { kind: 'component'; framework: 'generic' }
>['aliases'][number];

export type DocusaurusComponent = Extract<
  ComponentRegistryEntryType,
  { kind: 'component'; framework: 'docusaurus' }
>['name'];

export type StarlightComponent = Extract<
  ComponentRegistryEntryType,
  { kind: 'component'; framework: 'starlight' }
>['name'];

export type NextjsComponent = Extract<
  ComponentRegistryEntryType,
  { kind: 'component'; framework: 'nextjs' }
>['name'];

export type NextraComponent = Extract<
  ComponentRegistryEntryType,
  { kind: 'component'; framework: 'nextra' }
>['name'];

// generic component definitions w/ aliases (derived from registry)
export const GENERIC_COMPONENTS = buildGenericComponents();

// framework component lists (derived from registry)
export const FRAMEWORK_COMPONENTS = buildFrameworkComponents();

function buildGenericComponents(): Record<string, { aliases: string[] }> {
  const entries = COMPONENT_REGISTRY.filter(
    (entry): entry is GenericComponentEntry =>
      entry.kind === 'component' && entry.framework === 'generic'
  );

  const result: Record<string, { aliases: string[] }> = {};
  for (const entry of entries) {
    result[entry.name] = { aliases: [...entry.aliases] };
  }
  return result;
}

function buildFrameworkComponents(): Record<Framework, string[]> {
  const result: Record<Framework, string[]> = {
    docusaurus: [],
    starlight: [],
    nextjs: [],
    nextra: [],
  };

  for (const entry of COMPONENT_REGISTRY) {
    if (entry.kind !== 'component') {
      continue;
    }
    if (entry.framework === 'generic') {
      continue;
    }
    result[entry.framework].push(entry.name);
  }

  return result;
}
