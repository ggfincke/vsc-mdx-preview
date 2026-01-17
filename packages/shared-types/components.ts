// packages/shared-types/components.ts
// Canonical component registry - single source of truth for all component definitions
// Used by both extension (transpiler, resolver) & webview (preload, module loader)

// generic component definitions w/ their aliases
// auto-inject in Trusted Mode & transform in Safe Mode
export const GENERIC_COMPONENTS = {
  // Callout variants - informational boxes with type-based styling
  Callout: { aliases: ['Alert', 'Admonition'] as const },

  // Collapsible variants - expandable/collapsible content sections
  Collapsible: { aliases: ['Accordion', 'Details'] as const },

  // Tab components - tabbed content panels
  Tabs: { aliases: [] as const },
  TabItem: { aliases: ['Tab'] as const },

  // Code group - tabbed code blocks
  CodeGroup: { aliases: [] as const },
} as const;

// Derive types from the registry
export type GenericComponentName = keyof typeof GENERIC_COMPONENTS;
export type GenericComponentAlias =
  (typeof GENERIC_COMPONENTS)[GenericComponentName]['aliases'][number];

// framework-specific component shims
// replace imports from framework packages w/ preview-compatible implementations
export const FRAMEWORK_COMPONENTS = {
  // Docusaurus theme components
  docusaurus: ['Tabs', 'TabItem', 'CodeBlock', 'Details'] as const,

  // Starlight (Astro) components
  starlight: [
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
  ] as const,

  // Next.js components
  nextjs: ['Image', 'Link'] as const,

  // Nextra components (uses compound pattern: Tabs.Tab, Cards.Card)
  // We list main exports; subcomponents are accessed via parent
  nextra: ['Callout', 'Tabs', 'Cards', 'FileTree', 'Steps', 'Bleed'] as const,
} as const;

// Derive types from framework components
export type Framework = keyof typeof FRAMEWORK_COMPONENTS;
export type DocusaurusComponent =
  (typeof FRAMEWORK_COMPONENTS)['docusaurus'][number];
export type StarlightComponent =
  (typeof FRAMEWORK_COMPONENTS)['starlight'][number];
export type NextjsComponent = (typeof FRAMEWORK_COMPONENTS)['nextjs'][number];
export type NextraComponent = (typeof FRAMEWORK_COMPONENTS)['nextra'][number];

// base path prefix for shim module resolution
// extension resolves imports to these paths, webview maps to preloaded modules
export const SHIM_PREFIX = '@mdx-preview/shims' as const;

// framework import patterns resolved to shims
// used by alias-resolver in extension
export const FRAMEWORK_IMPORT_PATTERNS = {
  docusaurus: {
    // @theme/Tabs -> @mdx-preview/shims/docusaurus/Tabs
    themePattern: /^@theme\/(.+)$/,
    // @site/* -> workspace root (not a shim, real file)
    sitePattern: /^@site\/(.+)$/,
    // @docusaurus/* -> ignored (internal framework modules)
    internalPattern: /^@docusaurus\//,
  },
  starlight: {
    // @astrojs/starlight/components -> barrel import
    componentsPattern: /^@astrojs\/starlight\/components$/,
    // @astrojs/starlight/components/Card -> individual import
    componentPattern: /^@astrojs\/starlight\/components\/(.+)$/,
  },
  nextjs: {
    // next/image, next/link
    imagePattern: /^next\/image$/,
    linkPattern: /^next\/link$/,
  },
  nextra: {
    // nextra/components -> all components (Nextra 3.x barrel import)
    componentsPattern: /^nextra\/components$/,
    // nextra-theme-docs -> legacy theme imports (Nextra 2.x)
    themeDocsPattern: /^nextra-theme-docs$/,
    // nextra-theme-docs/components -> individual component imports
    themeDocsComponentPattern: /^nextra-theme-docs\/components$/,
    // nextra/components/Callout -> individual component imports
    componentPattern: /^nextra\/components\/(.+)$/,
  },
} as const;

// get all generic component names including aliases
// returns: ['Callout', 'Alert', 'Admonition', 'Collapsible', 'Accordion', 'Details', ...]
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
// returns: ['Callout', 'Collapsible', 'Tabs', 'TabItem', 'CodeGroup']
export function getPrimaryGenericComponentNames(): GenericComponentName[] {
  return Object.keys(GENERIC_COMPONENTS) as GenericComponentName[];
}

// get canonical component name for alias
// e.g., 'Alert' -> 'Callout', 'Accordion' -> 'Collapsible'
export function getCanonicalComponentName(
  nameOrAlias: string
): string | undefined {
  // Check if it's already a primary name
  if (nameOrAlias in GENERIC_COMPONENTS) {
    return nameOrAlias;
  }

  // Search aliases
  for (const [name, config] of Object.entries(GENERIC_COMPONENTS)) {
    if ((config.aliases as readonly string[]).includes(nameOrAlias)) {
      return name;
    }
  }

  return undefined;
}

// get component names for specific framework
export function getFrameworkComponents<F extends Framework>(
  framework: F
): readonly (typeof FRAMEWORK_COMPONENTS)[F][number][] {
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
    return (FRAMEWORK_COMPONENTS[framework] as readonly string[]).includes(
      name
    );
  }

  // Check all frameworks
  for (const components of Object.values(FRAMEWORK_COMPONENTS)) {
    if ((components as readonly string[]).includes(name)) {
      return true;
    }
  }
  return false;
}

// get shim path for generic component
// e.g., 'Callout' -> '@mdx-preview/shims/generic/Callout'
export function getGenericShimPath(componentName: string): string {
  return `${SHIM_PREFIX}/generic/${componentName}`;
}

// get shim path for framework component
// e.g., ('docusaurus', 'Tabs') -> '@mdx-preview/shims/docusaurus/Tabs'
export function getFrameworkShimPath(
  framework: Framework,
  componentName: string
): string {
  return `${SHIM_PREFIX}/${framework}/${componentName}`;
}
