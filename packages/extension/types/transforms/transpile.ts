// packages/extension/types/transforms/transpile.ts
// type definitions for transpilation

// result type for entry transformation (includes frontmatter)
export interface TransformEntryResult {
  code: string;
  // ESM code before CommonJS conversion (for import extraction)
  esmCode: string;
  frontmatter: Record<string, unknown>;
}

// result type for dependency transformation
// return both ESM (for import extraction) & CJS (for webview evaluation)
export interface TransformResult {
  // final CommonJS for webview evaluation
  code: string;
  // ESM code before CommonJS conversion
  esmCode: string;
}

// options for transpilation
export interface TranspileOptions {
  // prefer Sucrase
  useSucrase: boolean;
  // logging context
  context?: string;
  // file path
  filePath?: string;
}
