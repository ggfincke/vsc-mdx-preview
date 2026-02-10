// packages/extension/constants/runtime.ts
// runtime constants for the extension package (timeouts, limits, cache settings)

import {
  DEFAULT_PREVIEW_DEBOUNCE_DELAY_MS,
  DEFAULT_TAILWIND_COMPILATION_TIMEOUT_MS,
  DEFAULT_WATCHER_DEBOUNCE_MS,
} from '@mdx-preview/contracts';

// timeouts

// webview handshake timeout - how long to wait for webview to respond (ms)
export const WEBVIEW_HANDSHAKE_TIMEOUT_MS = 10000;

// default Tailwind CSS compilation timeout (ms) - user can override via setting
export const TAILWIND_COMPILATION_TIMEOUT_DEFAULT_MS =
  DEFAULT_TAILWIND_COMPILATION_TIMEOUT_MS;

// debounce intervals

// debounce delay for package.json watcher (ms) - use shared default
export const PACKAGE_JSON_WATCHER_DEBOUNCE_MS = DEFAULT_WATCHER_DEBOUNCE_MS;

// default preview update debounce delay (ms) - use shared default
export const PREVIEW_DEBOUNCE_DELAY_DEFAULT_MS =
  DEFAULT_PREVIEW_DEBOUNCE_DELAY_MS;

// error duplicate suppression window (ms)
export const ERROR_DEDUPE_WINDOW_DEFAULT_MS = 5000;

// limits

// max file watchers for dependency tracking (LRU eviction)
export const DEP_WATCHER_MAX_ENTRIES = 50;

// max character length for fetch requests (security limit)
export const MAX_FETCH_REQUEST_LENGTH = 2048;

// max entries in error deduplication map before FIFO eviction
export const ERROR_DEDUPE_MAX_ENTRIES = 1000;

// module fetching limits (security & DoS prevention)

// max module file size in bytes (5MB)
// prevent memory exhaustion from loading giant files
export const MAX_MODULE_FILE_SIZE_BYTES = 5 * 1024 * 1024;

// max dependencies per module (prevent combinatorial explosion)
export const MAX_DEPENDENCIES_PER_MODULE = 200;

// MDX compilation timeout (ms) - prevent hang on malicious/large MDX
export const MDX_COMPILATION_TIMEOUT_MS = 30000;

// module fetch file read timeout (ms) - prevent hang on slow filesystem
export const MODULE_FETCH_TIMEOUT_MS = 5000;

// caching

// enhanced-resolve cached file system TTL (ms) - 30s is safe since
// cache is cleared on package.json changes & manual refresh
export const RESOLVER_CACHE_TTL_MS = 30000;

// ui

// status bar item priority for trust indicator (higher = more left)
export const STATUS_BAR_TRUST_PRIORITY = 100;

// status bar item priority for framework indicator
export const STATUS_BAR_FRAMEWORK_PRIORITY = 99;

// character limit for CSP debug log preview
export const CSP_DEBUG_PREVIEW_LENGTH = 100;

// build paths

// webview app build directory (relative to extension root)
export const WEBVIEW_BUILD_DIR = 'build/webview-app';

// Vite manifest directory (relative to webview build dir)
export const VITE_MANIFEST_DIR = '.vite';

// Vite manifest filename
export const VITE_MANIFEST_FILE = 'manifest.json';
