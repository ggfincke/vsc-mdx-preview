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
  // extensions to try
  extensions: readonly string[];
  // index files
  indexFiles: readonly string[];
  // skip node_modules
  skipNodeModules?: boolean;
}
