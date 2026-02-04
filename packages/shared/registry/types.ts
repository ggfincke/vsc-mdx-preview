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
  // canonical name
  name: string;

  // framework
  framework: FrameworkId;

  // import aliases
  importSpecifiers: readonly string[];

  // shim path
  shimPath: string;

  // preload ID
  preloadId: string;

  // webview import
  webviewImport: string;

  // expose bare
  exposeAsBareImport?: boolean;
}

export interface ComponentDefinition extends ComponentDefinitionBase {
  kind: 'component';

  // aliases
  aliases: readonly string[];

  // import kind
  importKind?: 'default' | 'named';

  // import name
  importName?: string;
}

export interface ComponentBarrelDefinition extends ComponentDefinitionBase {
  kind: 'barrel';

  // export names
  exportNames: readonly string[];
}

export type ComponentRegistryEntry =
  | ComponentDefinition
  | ComponentBarrelDefinition;
