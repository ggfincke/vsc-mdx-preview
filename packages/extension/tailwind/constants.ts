// packages/extension/tailwind/constants.ts
// centralized constants for the Tailwind module
//
// this file consolidates magic numbers from across the Tailwind module
// to improve maintainability & documentation

import {
  STANDARD_CACHE_TTL_MS,
  STANDARD_DEBOUNCE_MS,
  DEFAULT_TAILWIND_MAX_FILE_SIZE_BYTES,
  DEFAULT_TAILWIND_MAX_CSS_FILES_TO_SEARCH,
  DEFAULT_TAILWIND_CACHE_MAX_ENTRIES,
  DEFAULT_TAILWIND_CACHE_TTL_SECONDS,
} from '@mdx-preview/shared';

// cache configuration

// default maximum entries in the CSS cache (LRU eviction)
export const CACHE_DEFAULT_MAX_ENTRIES = 20;

// default maximum entries in the per-file scan cache (LRU eviction)
// higher than CSS cache since we cache per-file instead of per-document
export const SCAN_CACHE_DEFAULT_MAX_ENTRIES = 200;

// default cache TTL in milliseconds (5 minutes) - uses shared constant
export const CACHE_DEFAULT_TTL_MS = STANDARD_CACHE_TTL_MS;

// version detection cache TTL in milliseconds (5 minutes) - uses shared constant
export const VERSION_CACHE_TTL_MS = STANDARD_CACHE_TTL_MS;

// cache schema version - bump when cache key structure or compilation behavior changes
// this ensures stale caches are invalidated on extension updates
export const TAILWIND_CACHE_SCHEMA_VERSION = 1;

// processing limits

// maximum characters per @source inline() directive for Tailwind v4
// Tailwind v4 uses CSS-based `@source inline("...")` directives instead of the
// v3 `content` configuration option - this limit prevents potential issues w/
// PostCSS or CSS parsers when processing very long inline source strings
// the value of 2000 is a conservative defensive limit - content exceeding this
// is split into multiple @source directives
export const MAX_INLINE_SOURCE_CHUNK_SIZE = 2000;

// maximum recursion depth for nested template literal extraction
// prevents stack overflow from pathological input like deeply nested templates
export const SCANNER_MAX_RECURSION_DEPTH = 10;

// concurrency limits

// maximum concurrent dependency resolution operations
export const TAILWIND_DEPENDENCY_RESOLUTION_LIMIT = 10;

// maximum concurrent file read operations
export const TAILWIND_FILE_READ_LIMIT = 8;

// default maximum file size in bytes to process (10 MB)
export const DEFAULT_MAX_FILE_SIZE_BYTES = DEFAULT_TAILWIND_MAX_FILE_SIZE_BYTES;

// default maximum CSS files to search when detecting entry CSS
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

// minimum supported Tailwind CSS major version
export const MIN_SUPPORTED_TAILWIND_VERSION = 4;

// maximum known Tailwind CSS major version (for future-proofing warnings)
export const MAX_KNOWN_TAILWIND_VERSION = 5;

// watcher configuration

// debounce delay in milliseconds for Tailwind config file watcher
// prevents rapid recompilations when files are saved multiple times in quick succession
// uses shared standard debounce constant
export const CONFIG_WATCHER_DEBOUNCE_MS = STANDARD_DEBOUNCE_MS;

// class extraction patterns

// valid Tailwind class token pattern
// matches common Tailwind patterns including:
// - basic classes: flex, gap-4, text-sm
// - responsive/state variants: sm:flex, hover:bg-blue-500
// - arbitrary values: w-[100px], bg-[#ff0000]
// - negative values: -mt-4
// - fractions: w-1/2
export const CLASS_TOKEN_RE = /^[A-Za-z0-9:_/.\-[\]()%,#=!]+$/;
