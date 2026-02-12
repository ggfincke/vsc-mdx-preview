// packages/extension/constants/extensions.ts
// centralized file extension constants for module resolution & file handling

// base extension categories (atomic sets)

export const TS_EXTENSIONS = ['.ts', '.tsx'] as const;
export const JS_EXTENSIONS = ['.js', '.jsx'] as const;
export const ESM_EXTENSIONS = ['.mjs'] as const;
export const CJS_EXTENSIONS = ['.cjs'] as const;
export const MDX_EXTENSIONS = ['.mdx', '.md'] as const;
export const JSON_EXTENSIONS = ['.json'] as const;
export const CSS_EXTENSIONS = ['.css'] as const;
export const SASS_EXTENSIONS = ['.scss', '.sass'] as const;
export const IMAGE_EXTENSIONS = [
  '.gif',
  '.png',
  '.jpg',
  '.jpeg',
  '.svg',
  '.webp',
] as const;

// composed extension sets

export const SCRIPT_EXTENSIONS = [
  ...JS_EXTENSIONS,
  ...TS_EXTENSIONS,
  ...ESM_EXTENSIONS,
  ...CJS_EXTENSIONS,
] as const;

export const SCRIPTABLE_EXTENSIONS = [
  ...SCRIPT_EXTENSIONS,
  ...MDX_EXTENSIONS,
] as const;

// TypeScript path resolution (includes JSON & '' for exact path)
export const TYPESCRIPT_RESOLUTION_EXTENSIONS = [
  ...TS_EXTENSIONS,
  ...JS_EXTENSIONS,
  ...ESM_EXTENSIONS,
  ...JSON_EXTENSIONS,
  '',
] as const;

// general file probing ('' first for exact path matching)
export const FILE_PROBE_EXTENSIONS = [
  '',
  ...TS_EXTENSIONS,
  ...JS_EXTENSIONS,
  ...MDX_EXTENSIONS,
] as const;

// enhanced-resolve extensions
export const BROWSER_RESOLVE_EXTENSIONS = [
  ...JS_EXTENSIONS,
  ...TS_EXTENSIONS,
  ...ESM_EXTENSIONS,
  ...CJS_EXTENSIONS,
  ...JSON_EXTENSIONS,
] as const;

export const NODE_RESOLVE_EXTENSIONS = ['.js', '.mjs', '.cjs'] as const;

// index file names
export const TS_INDEX_FILES = [
  'index.ts',
  'index.tsx',
  'index.js',
  'index.jsx',
  'index.mjs',
] as const;

export const FILE_PROBE_INDEX_FILES = [
  'index.ts',
  'index.tsx',
  'index.js',
  'index.jsx',
] as const;
