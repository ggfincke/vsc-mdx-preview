// packages/webview-app/src/module-loader/types.ts
// module loader types for Trusted Mode

// a cached module
export interface Module {
  id: string;
  exports: any;
  loaded: boolean;
}

// result from fetching a module via RPC
export interface FetchResult {
  fsPath: string;
  code: string;
  dependencies: string[];
  css?: string;
}

// MDX function-body runtime
// MDX 3 compiled w/ outputFormat: 'function-body' expects these in arguments[0]
export interface MDXRuntime {
  Fragment: any;
  jsx: any;
  jsxs: any;
  jsxDEV?: any;
  useMDXComponents?: () => Record<string, any>;
}

// extended runtime including require for CJS-style modules
export interface ModuleRuntime extends MDXRuntime {
  require: (id: string) => any;
}

// module fetcher function type
export type ModuleFetcher = (
  request: string,
  isBare: boolean,
  parentId: string
) => Promise<FetchResult | undefined>;
