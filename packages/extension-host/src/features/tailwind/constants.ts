// packages/extension-host/src/features/tailwind/constants.ts
// centralized constants for the Tailwind module - consolidate magic numbers for maintainability

import {
  DEFAULT_TAILWIND_CACHE_MAX_ENTRIES,
  DEFAULT_TAILWIND_CACHE_TTL_SECONDS,
  DEFAULT_TAILWIND_MAX_CSS_FILES_TO_SEARCH,
  DEFAULT_TAILWIND_MAX_FILE_SIZE_BYTES,
} from '@mdx-preview/contracts';

// cache configuration

// default maximum entries in the CSS cache (LRU eviction)
export const CACHE_DEFAULT_MAX_ENTRIES = 20;

// default maximum entries in the per-file scan cache (LRU eviction)
// higher than CSS cache since we cache per-file instead of per-document
export const SCAN_CACHE_DEFAULT_MAX_ENTRIES = 200;

// TailwindDetector config path cache limit (LRU eviction)
export const DETECTOR_CONFIG_CACHE_MAX_ENTRIES = 20;

// TailwindDetector entry CSS path cache limit (LRU eviction)
export const DETECTOR_ENTRY_CSS_CACHE_MAX_ENTRIES = 20;

// TailwindDetector version info cache limit (LRU eviction)
export const DETECTOR_VERSION_CACHE_MAX_ENTRIES = 10;

// cache schema version - bump when cache key structure or compilation behavior changes
export const TAILWIND_CACHE_SCHEMA_VERSION = 1;

// processing limits

// max characters per @source inline() directive for Tailwind v4
// split long CSS-based source directives to protect PostCSS parsing
// 2000 is a conservative defensive chunk size
export const MAX_INLINE_SOURCE_CHUNK_SIZE = 2000;

// max recursion depth for nested template literal extraction
// prevent stack overflow from pathological input like deeply nested templates
export const SCANNER_MAX_RECURSION_DEPTH = 10;

// concurrency limits

// max concurrent dependency resolution operations
export const TAILWIND_DEPENDENCY_RESOLUTION_LIMIT = 10;

// max concurrent file read operations
export const TAILWIND_FILE_READ_LIMIT = 8;

// default max file size in bytes to process (10 MB)
export const DEFAULT_MAX_FILE_SIZE_BYTES = DEFAULT_TAILWIND_MAX_FILE_SIZE_BYTES;

// default max CSS files to search when detecting entry CSS
export const DEFAULT_MAX_CSS_FILES_TO_SEARCH =
  DEFAULT_TAILWIND_MAX_CSS_FILES_TO_SEARCH;

// processor cache defaults (VS Code settings defaults)

// default max entries for processor-level cache
export const PROCESSOR_CACHE_DEFAULT_MAX_ENTRIES =
  DEFAULT_TAILWIND_CACHE_MAX_ENTRIES;

// default cache TTL in seconds for processor-level cache (5 minutes)
export const PROCESSOR_CACHE_DEFAULT_TTL_SECONDS =
  DEFAULT_TAILWIND_CACHE_TTL_SECONDS;

// version boundaries

// min supported Tailwind CSS major version
export const MIN_SUPPORTED_TAILWIND_VERSION = 4;

// max known Tailwind CSS major version (for future-proofing warnings)
export const MAX_KNOWN_TAILWIND_VERSION = 5;

// watcher configuration

// class extraction patterns

// valid Tailwind class token pattern
// match basic classes, variants, arbitrary values, negatives & fractions
export const CLASS_TOKEN_RE = /^[A-Za-z0-9:_/.\-[\]()%,#=!]+$/;
