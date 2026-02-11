// packages/codegen/src/lib/codegen-utils.ts
// shared utilities for codegen library functions

// normalize a file path to a valid import path (forward slashes, relative prefix)
export function normalizeImportPath(filePath: string): string {
  const withSlashes = filePath.replace(/\\/g, '/');
  if (withSlashes.startsWith('.')) {
    return withSlashes;
  }
  return `./${withSlashes}`;
}
