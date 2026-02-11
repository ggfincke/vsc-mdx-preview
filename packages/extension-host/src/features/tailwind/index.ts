// packages/extension/tailwind/index.ts
// barrel exports for the Tailwind module

// primary API - TailwindProcessor is the main entry point for Tailwind compilation
export { TailwindProcessor } from './TailwindProcessor';
export type {
  TailwindProfileOptions,
  TailwindProcessOptions,
  TailwindProcessResult,
  TailwindRuntimeProfile,
} from './TailwindProcessor';

// detection - config/CSS/version discovery
export { TailwindDetector } from './TailwindDetector';
export type {
  TailwindVersionInfo,
  TailwindDetectionResult,
  TailwindProfile,
  TailwindProfileDetectionResult,
  ResolveWorkspaceRootOptions,
  ResolveConfigPathOptions,
  ResolveEntryCssPathOptions,
  DetectTailwindProfileOptions,
} from './TailwindDetector';

// scanning - class extraction from MDX/JSX
export { TailwindScanner } from './TailwindScanner';
export type {
  TailwindScanOptions,
  TailwindScanResult,
} from './TailwindScanner';

// scan hashing - utility for incremental scan cache keys
export { computeContentHash } from './scanning/content-hash';

// compilation - PostCSS integration for v3/v4
export { TailwindCompiler } from './TailwindCompiler';
export type {
  TailwindCompileOptions,
  TailwindVersion,
} from './TailwindCompiler';

// constants - centralized configuration values
export {
  CACHE_DEFAULT_MAX_ENTRIES,
  SCAN_CACHE_DEFAULT_MAX_ENTRIES,
  MAX_INLINE_SOURCE_CHUNK_SIZE,
  SCANNER_MAX_RECURSION_DEPTH,
  DEFAULT_MAX_FILE_SIZE_BYTES,
  DEFAULT_MAX_CSS_FILES_TO_SEARCH,
  PROCESSOR_CACHE_DEFAULT_MAX_ENTRIES,
  PROCESSOR_CACHE_DEFAULT_TTL_SECONDS,
  MIN_SUPPORTED_TAILWIND_VERSION,
  MAX_KNOWN_TAILWIND_VERSION,
} from './constants';
