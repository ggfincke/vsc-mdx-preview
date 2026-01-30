// packages/extension/types/resolver/file-prober.ts
// type definitions for file probing

// cached stat result containing file existence & type info
export interface StatResult {
  exists: boolean;
  isFile: boolean;
  isDirectory: boolean;
}

// options for file probing operations
export interface FileProbingOptions {
  // extensions to try when probing (e.g., ['.ts', '.tsx', '.js'])
  extensions?: string[];
  // index files to check for directory imports
  indexFiles?: string[];
  // whether to use cached stat results
  useCache?: boolean;
}
