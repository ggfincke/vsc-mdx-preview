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
  // extensions to probe
  extensions?: string[];
  // index files
  indexFiles?: string[];
  // use stat cache
  useCache?: boolean;
}
