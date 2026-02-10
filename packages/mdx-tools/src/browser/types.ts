// fetch result w/ module code & dependency list
export interface FetchResult {
  fsPath: string;
  code: string;
  dependencies: string[];
  css?: string;
}

export type Framework = 'docusaurus' | 'starlight' | 'nextjs' | 'nextra';
export type FrameworkId = Framework | 'generic';

export const PRELOADED_MODULE_IDS = {
  react: 'npm://react@18',
  reactDom: 'npm://react-dom@18',
  reactDomClient: 'npm://react-dom/client@18',
  jsxRuntime: 'npm://react/jsx-runtime@18',
  mdxReact: 'npm://@mdx-js/react@3',
  vscodeLayout: 'npm://vscode-markdown-layout@0.1.0',
} as const;

// module export value
type ModuleExports = Record<string, unknown> | unknown;

// cached module
export interface Module {
  id: string;
  exports: ModuleExports;
  loaded: boolean;
}

// runtime values injected into evaluated MDX/CJS modules
export interface MDXRuntime {
  Fragment: unknown;
  jsx: unknown;
  jsxs: unknown;
  jsxDEV?: unknown;
  useMDXComponents?: () => Record<string, unknown>;
}

// runtime w/ require injected by loader
export interface ModuleRuntime extends MDXRuntime {
  require: (id: string) => unknown;
}

export type ModuleFetcher = (
  request: string,
  isBare: boolean,
  parentId: string
) => Promise<FetchResult | undefined>;

// typed preload payload (atomic registration entry)
export interface PreloadEntry {
  id: string;
  exports: unknown;
  aliases?: string[];
}

export interface ModuleLoaderConfig {
  maxModuleLoadDepth?: number;
  maxConcurrentFetches?: number;
  preloadAliases?: Record<string, string>;
  runtime?: Partial<MDXRuntime>;
}

export interface StyleInjector {
  injectModuleCss(id: string, css: string): void;
  removeModuleCss(id: string): void;
  clearModules(): void;
}
