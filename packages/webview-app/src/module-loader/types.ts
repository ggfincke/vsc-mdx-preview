/**
 * Module loader types for Trusted Mode.
 */

/**
 * A cached module.
 */
export interface Module {
  id: string;
  exports: any;
  loaded: boolean;
}

/**
 * Result from fetching a module via RPC.
 */
export interface FetchResult {
  fsPath: string;
  code: string;
  dependencies: string[];
  css?: string;
}

/**
 * MDX function-body runtime.
 * MDX 3 compiled with outputFormat: 'function-body' expects these in arguments[0].
 */
export interface MDXRuntime {
  Fragment: any;
  jsx: any;
  jsxs: any;
  jsxDEV?: any;
  useMDXComponents?: () => Record<string, any>;
}

/**
 * Extended runtime including require for CJS-style modules.
 */
export interface ModuleRuntime extends MDXRuntime {
  require: (id: string) => any;
}

/**
 * Module fetcher function type.
 */
export type ModuleFetcher = (
  request: string,
  isBare: boolean,
  parentId: string
) => Promise<FetchResult | undefined>;
