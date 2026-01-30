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
// returns both ESM (for import extraction) & CJS (for webview evaluation)
export interface TransformResult {
  code: string; // Final CommonJS for webview evaluation
  esmCode: string; // ESM code before CommonJS conversion
}

// options for transpilation
export interface TranspileOptions {
  // whether to prefer Sucrase over Babel
  useSucrase: boolean;
  // context for debug logging (e.g., 'entry' or 'dependency')
  context?: string;
  // file path for debug logging
  filePath?: string;
}
