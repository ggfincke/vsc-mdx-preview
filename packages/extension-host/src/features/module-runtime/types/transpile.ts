// packages/extension-host/src/features/module-runtime/types/transpile.ts
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

// re-export canonical transpile options type from runtime module
export type { TranspileOptions } from '../transform/selector';
