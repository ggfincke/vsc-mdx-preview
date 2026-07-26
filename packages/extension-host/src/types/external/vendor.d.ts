// packages/extension-host/src/types/external/vendor.d.ts
// type declarations for modules w/o @types packages

declare module 'is-module' {
  function isModule(code: string): boolean;
  export = isModule;
}

declare module 'sucrase' {
  export interface TransformOptions {
    transforms: string[];
    filePath?: string;
    disableESTransforms?: boolean;
    jsxRuntime?: 'classic' | 'automatic' | 'preserve';
    production?: boolean;
  }

  export interface TransformResult {
    code: string;
    sourceMap?: unknown;
  }

  export function transform(
    code: string,
    options: TransformOptions
  ): TransformResult;
}
