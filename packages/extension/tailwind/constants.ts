// packages/extension/tailwind/constants.ts
// centralized constants for the Tailwind module
//
// this file consolidates magic numbers from across the Tailwind module
// to improve maintainability & documentation.

// =============================================================================
// cache configuration
// =============================================================================

// default maximum entries in the CSS cache (LRU eviction)
export const CACHE_DEFAULT_MAX_ENTRIES = 20;

// default cache TTL in milliseconds (5 minutes)
export const CACHE_DEFAULT_TTL_MS = 5 * 60 * 1000;

// version detection cache TTL in milliseconds (5 minutes)
export const VERSION_CACHE_TTL_MS = 5 * 60 * 1000;

// =============================================================================
// processing limits
// =============================================================================

// maximum characters per @source inline() directive for Tailwind v4
// Tailwind v4 uses CSS-based `@source inline("...")` directives instead of the
// v3 `content` configuration option. This limit prevents potential issues w/
// PostCSS or CSS parsers when processing very long inline source strings
// the value of 2000 is a conservative defensive limit. Content exceeding this
// is split into multiple @source directives
export const MAX_INLINE_SOURCE_CHUNK_SIZE = 2000;

// maximum recursion depth for nested template literal extraction
// prevents stack overflow from pathological input like deeply nested templates
export const SCANNER_MAX_RECURSION_DEPTH = 10;

// default maximum file size in bytes to process (10 MB)
export const DEFAULT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

// default maximum CSS files to search when detecting entry CSS
export const DEFAULT_MAX_CSS_FILES_TO_SEARCH = 500;

// =============================================================================
// processor cache defaults (VS Code settings defaults)
// =============================================================================

// default max entries for processor-level cache
export const PROCESSOR_CACHE_DEFAULT_MAX_ENTRIES = 50;

// default cache TTL in seconds for processor-level cache (5 minutes)
export const PROCESSOR_CACHE_DEFAULT_TTL_SECONDS = 300;

// =============================================================================
// version boundaries
// =============================================================================

// minimum supported Tailwind CSS major version
export const MIN_SUPPORTED_TAILWIND_VERSION = 3;

// maximum known Tailwind CSS major version (for future-proofing warnings)
export const MAX_KNOWN_TAILWIND_VERSION = 4;

// =============================================================================
// watcher configuration
// =============================================================================

// debounce delay in milliseconds for Tailwind config file watcher
// prevents rapid recompilations when files are saved multiple times in quick succession
export const CONFIG_WATCHER_DEBOUNCE_MS = 300;
