// packages/extension/types.d.ts
// type declarations for modules without @types packages

declare module 'is-module' {
  function isModule(code: string): boolean;
  export = isModule;
}

declare module '@mdx-js/mdx' {
  export interface CompileOptions {
    outputFormat?: 'program' | 'function-body';
    development?: boolean;
    jsx?: boolean;
    jsxImportSource?: string;
    jsxRuntime?: 'automatic' | 'classic';
    providerImportSource?: string;
    remarkPlugins?: unknown[];
    rehypePlugins?: unknown[];
  }

  export function compile(
    source: string,
    options?: CompileOptions
  ): Promise<{ toString(): string }>;
}

declare module '@babel/preset-env' {
  import type { PluginItem } from '@babel/core';
  const preset: PluginItem;
  export default preset;
}

declare module '@babel/preset-react' {
  import type { PluginItem } from '@babel/core';
  const preset: PluginItem;
  export default preset;
}
