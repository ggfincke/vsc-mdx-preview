// packages/registry/src/components/types.ts
// interface definitions for component registry (not derived from COMPONENT_REGISTRY)

import type {
  Framework,
  FrameworkId,
  FrameworkSetting,
} from '@mdx-preview/contracts';

export const SHIM_PREFIX = '@mdx-preview/shims' as const;
export type { Framework, FrameworkId, FrameworkSetting };

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
