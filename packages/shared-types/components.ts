// packages/shared-types/components.ts
// Canonical component registry - single source of truth for all component definitions
// Used by both extension (transpiler, resolver) and webview (preload, module loader)

// ============================================================================
// Generic Components (built-in, framework-agnostic shims)
// ============================================================================

/**
 * Generic component definitions with their aliases.
 * These components are auto-injected in Trusted Mode and transformed in Safe Mode.
 */
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

// ============================================================================
// Framework-Specific Components (shims for framework UI libraries)
// ============================================================================

/**
 * Framework-specific component shims.
 * These replace imports from framework packages with preview-compatible implementations.
 */
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
} as const;

// Derive types from framework components
export type Framework = keyof typeof FRAMEWORK_COMPONENTS;
export type DocusaurusComponent =
  (typeof FRAMEWORK_COMPONENTS)['docusaurus'][number];
export type StarlightComponent =
  (typeof FRAMEWORK_COMPONENTS)['starlight'][number];
export type NextjsComponent = (typeof FRAMEWORK_COMPONENTS)['nextjs'][number];

// ============================================================================
// Shim Path Configuration
// ============================================================================

/**
 * Base path prefix for shim module resolution.
 * Extension resolves imports to these paths, webview maps them to preloaded modules.
 */
export const SHIM_PREFIX = '@mdx-preview/shims' as const;

/**
 * Framework import patterns that should be resolved to shims.
 * Used by alias-resolver in the extension.
 */
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
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all generic component names including aliases.
 * Returns: ['Callout', 'Alert', 'Admonition', 'Collapsible', 'Accordion', 'Details', ...]
 */
export function getAllGenericComponentNames(): string[] {
  const names: string[] = [];
  for (const [name, config] of Object.entries(GENERIC_COMPONENTS)) {
    names.push(name, ...config.aliases);
  }
  return names;
}

/**
 * Get a Set of all generic component names for O(1) lookup.
 */
export function getGenericComponentSet(): Set<string> {
  return new Set(getAllGenericComponentNames());
}

/**
 * Get primary generic component names only (no aliases).
 * Returns: ['Callout', 'Collapsible', 'Tabs', 'TabItem', 'CodeGroup']
 */
export function getPrimaryGenericComponentNames(): GenericComponentName[] {
  return Object.keys(GENERIC_COMPONENTS) as GenericComponentName[];
}

/**
 * Get the canonical component name for an alias.
 * E.g., 'Alert' -> 'Callout', 'Accordion' -> 'Collapsible'
 */
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

/**
 * Get component names for a specific framework.
 */
export function getFrameworkComponents<F extends Framework>(
  framework: F
): readonly (typeof FRAMEWORK_COMPONENTS)[F][number][] {
  return FRAMEWORK_COMPONENTS[framework];
}

/**
 * Check if a component name is a known generic component (including aliases).
 */
export function isGenericComponent(name: string): boolean {
  return getGenericComponentSet().has(name);
}

/**
 * Check if a component name is a framework-specific component.
 */
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

/**
 * Get the shim path for a generic component.
 * E.g., 'Callout' -> '@mdx-preview/shims/generic/Callout'
 */
export function getGenericShimPath(componentName: string): string {
  return `${SHIM_PREFIX}/generic/${componentName}`;
}

/**
 * Get the shim path for a framework component.
 * E.g., ('docusaurus', 'Tabs') -> '@mdx-preview/shims/docusaurus/Tabs'
 */
export function getFrameworkShimPath(
  framework: Framework,
  componentName: string
): string {
  return `${SHIM_PREFIX}/${framework}/${componentName}`;
}
