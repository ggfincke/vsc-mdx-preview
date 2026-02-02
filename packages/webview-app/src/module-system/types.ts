// packages/webview-app/src/module-system/types.ts
// module system types for Trusted Mode

import type { FetchResult } from '@mdx-preview/shared';

// re-export FetchResult from shared
export type { FetchResult } from '@mdx-preview/shared';

// module export value
type ModuleExports = Record<string, unknown> | unknown;

// cached module
export interface Module {
  id: string;
  exports: ModuleExports;
  loaded: boolean;
}

// MDX function-body runtime
// MDX 3 compiled w/ outputFormat: 'function-body' expect these in arguments[0]
export interface MDXRuntime {
  Fragment: unknown;
  jsx: unknown;
  jsxs: unknown;
  jsxDEV?: unknown;
  useMDXComponents?: () => Record<string, unknown>;
}

// extended runtime including require for CJS-style modules
export interface ModuleRuntime extends MDXRuntime {
  require: (id: string) => unknown;
}

// module fetcher function type
export type ModuleFetcher = (
  request: string,
  isBare: boolean,
  parentId: string
) => Promise<FetchResult | undefined>;
