// packages/shared/registry/components.ts
// canonical component registry (single source of truth for shims)

export const SHIM_PREFIX = '@mdx-preview/shims' as const;

// framework IDs used by the shim registry
export type Framework = 'docusaurus' | 'starlight' | 'nextjs' | 'nextra';
export type FrameworkId = Framework | 'generic';

export type ComponentKind = 'component' | 'barrel';

export interface ComponentDefinitionBase {
  // canonical name for this shim entry (component name or barrel identifier)
  name: string;
  // framework this shim belongs to
  framework: FrameworkId;
  // import specifiers users write in MDX
  importSpecifiers: readonly string[];
  // internal shim path used by the extension
  shimPath: string;
  // canonical preloaded module ID used by the webview
  preloadId: string;
  // webview import path (relative to webview src/)
  webviewImport: string;
  // whether to map bare names/aliases to this preload ID
  exposeAsBareImport?: boolean;
}

export interface ComponentDefinition extends ComponentDefinitionBase {
  kind: 'component';
  // aliases that should map to the same component
  aliases: readonly string[];
  // default import unless specified
  importKind?: 'default' | 'named';
  // named import to use when importKind is 'named'
  importName?: string;
}

export interface ComponentBarrelDefinition extends ComponentDefinitionBase {
  kind: 'barrel';
  // named exports to expose from the barrel module
  exportNames: readonly string[];
}

export type ComponentRegistryEntry =
  | ComponentDefinition
  | ComponentBarrelDefinition;

export const COMPONENT_REGISTRY = [
  // ─────────────────────────────────────────────────────────────
  // Generic components (framework-agnostic)
  // ─────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────
  // Docusaurus components
  // ─────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────
  // Starlight components
  // ─────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────
  // Next.js components
  // ─────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────
  // Nextra components
  // ─────────────────────────────────────────────────────────────
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

// Derive types from the registry for stronger typing across the repo
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

// Generic component definitions with aliases (derived from registry)
export const GENERIC_COMPONENTS = buildGenericComponents();

// Framework component lists (derived from registry)
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

// get all generic component names including aliases
export function getAllGenericComponentNames(): string[] {
  const names: string[] = [];
  for (const [name, config] of Object.entries(GENERIC_COMPONENTS)) {
    names.push(name, ...config.aliases);
  }
  return names;
}

// get Set of all generic component names for O(1) lookup
export function getGenericComponentSet(): Set<string> {
  return new Set(getAllGenericComponentNames());
}

// get primary generic component names only (no aliases)
export function getPrimaryGenericComponentNames(): GenericComponentName[] {
  return Object.keys(GENERIC_COMPONENTS) as GenericComponentName[];
}

// get canonical component name for alias
export function getCanonicalComponentName(
  nameOrAlias: string
): string | undefined {
  if (nameOrAlias in GENERIC_COMPONENTS) {
    return nameOrAlias;
  }

  for (const [name, config] of Object.entries(GENERIC_COMPONENTS)) {
    if (config.aliases.includes(nameOrAlias)) {
      return name;
    }
  }

  return undefined;
}

// get component names for specific framework
export function getFrameworkComponents<F extends Framework>(
  framework: F
): readonly string[] {
  return FRAMEWORK_COMPONENTS[framework];
}

// check if component name is known generic component (including aliases)
export function isGenericComponent(name: string): boolean {
  return getGenericComponentSet().has(name);
}

// check if component name is framework-specific component
export function isFrameworkComponent(
  name: string,
  framework?: Framework
): boolean {
  if (framework) {
    return FRAMEWORK_COMPONENTS[framework].includes(name);
  }

  for (const components of Object.values(FRAMEWORK_COMPONENTS)) {
    if (components.includes(name)) {
      return true;
    }
  }
  return false;
}

// get shim path for generic component
export function getGenericShimPath(componentName: string): string {
  return `${SHIM_PREFIX}/generic/${componentName}`;
}

// get shim path for framework component
export function getFrameworkShimPath(
  framework: Framework,
  componentName: string
): string {
  return `${SHIM_PREFIX}/${framework}/${componentName}`;
}
