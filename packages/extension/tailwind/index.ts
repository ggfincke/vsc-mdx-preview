// packages/extension/tailwind/index.ts
// barrel exports for the Tailwind module

// primary API - TailwindProcessor is the main entry point for Tailwind compilation
export { TailwindProcessor } from './TailwindProcessor';
export type {
  TailwindProcessOptions,
  TailwindProcessResult,
} from './TailwindProcessor';

// detection - config/CSS/version discovery
export { TailwindDetector } from './TailwindDetector';
export type {
  TailwindVersionInfo,
  TailwindDetectionResult,
  ResolveWorkspaceRootOptions,
  ResolveConfigPathOptions,
  ResolveEntryCssPathOptions,
} from './TailwindDetector';

// scanning - class extraction from MDX/JSX
export { TailwindScanner } from './TailwindScanner';
export type {
  TailwindScanOptions,
  TailwindScanResult,
} from './TailwindScanner';

// caching - LRU cache w/ TTL
export { TailwindCache } from './TailwindCache';
export type { TailwindCacheOptions } from './TailwindCache';

// scan caching - per-file class extraction cache
export { TailwindScanCache, computeContentHash } from './TailwindScanCache';
export type { TailwindScanCacheOptions } from './TailwindScanCache';

// compilation - PostCSS integration for v3/v4
export { TailwindCompiler } from './TailwindCompiler';
export type {
  TailwindCompileOptions,
  TailwindVersion,
} from './TailwindCompiler';

// constants - centralized configuration values
export {
  CACHE_DEFAULT_MAX_ENTRIES,
  CACHE_DEFAULT_TTL_MS,
  SCAN_CACHE_DEFAULT_MAX_ENTRIES,
  VERSION_CACHE_TTL_MS,
  MAX_INLINE_SOURCE_CHUNK_SIZE,
  SCANNER_MAX_RECURSION_DEPTH,
  DEFAULT_MAX_FILE_SIZE_BYTES,
  DEFAULT_MAX_CSS_FILES_TO_SEARCH,
  PROCESSOR_CACHE_DEFAULT_MAX_ENTRIES,
  PROCESSOR_CACHE_DEFAULT_TTL_SECONDS,
  MIN_SUPPORTED_TAILWIND_VERSION,
  MAX_KNOWN_TAILWIND_VERSION,
  CONFIG_WATCHER_DEBOUNCE_MS,
} from './constants';
