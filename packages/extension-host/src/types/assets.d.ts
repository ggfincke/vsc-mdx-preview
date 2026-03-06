// packages/extension-host/src/types/assets.d.ts
// type declarations for non-code asset imports (esbuild loaders)

declare module '*.md' {
  const content: string;
  export default content;
}
