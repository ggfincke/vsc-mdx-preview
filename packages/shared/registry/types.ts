// packages/shared/registry/types.ts
// interface definitions for component registry (not derived from COMPONENT_REGISTRY)

export const SHIM_PREFIX = '@mdx-preview/shims' as const;

// framework IDs used by the shim registry
// Framework = frameworks w/ shims (excludes 'generic')
export type Framework = 'docusaurus' | 'starlight' | 'nextjs' | 'nextra';

// FrameworkId = all frameworks including 'generic' (canonical runtime type)
export type FrameworkId = Framework | 'generic';

// FrameworkSetting = VS Code setting type ('auto' triggers detection)
export type FrameworkSetting = 'auto' | FrameworkId;

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
