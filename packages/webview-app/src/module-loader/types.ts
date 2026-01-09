// packages/webview-app/src/module-loader/types.ts
// module loader types for Trusted Mode

// re-export FetchResult from shared-types
export type { FetchResult } from '@mdx-preview/shared-types';

// a cached module
export interface Module {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  exports: any;
  loaded: boolean;
}

// MDX function-body runtime
// MDX 3 compiled w/ outputFormat: 'function-body' expects these in arguments[0]
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
import type { FetchResult } from '@mdx-preview/shared-types';
export type ModuleFetcher = (
  request: string,
  isBare: boolean,
  parentId: string
) => Promise<FetchResult | undefined>;
