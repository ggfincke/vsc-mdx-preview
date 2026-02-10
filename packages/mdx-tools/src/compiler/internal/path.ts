import * as path from 'path';

function normalizePathSeparators(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

export function toAbsolutePath(inputPath: string, baseDir: string): string {
  if (path.isAbsolute(inputPath)) {
    return inputPath;
  }
  return path.resolve(baseDir, inputPath);
}

export function toRelativeImportPath(
  absolutePath: string,
  fromDir: string
): string {
  let relativePath = path.relative(fromDir, absolutePath);
  if (!relativePath.startsWith('.') && !relativePath.startsWith('/')) {
    relativePath = `./${relativePath}`;
  }
  return normalizePathSeparators(relativePath);
}
