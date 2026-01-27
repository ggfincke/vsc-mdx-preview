// packages/extension/constants.ts
// centralized constants for the extension package

import {
  STANDARD_DEBOUNCE_MS,
  STANDARD_WATCHER_DEBOUNCE_MS,
} from '@mdx-preview/shared';

// -- timeouts --

// webview handshake timeout - how long to wait for webview to respond (ms)
export const WEBVIEW_HANDSHAKE_TIMEOUT_MS = 10000;

// default Tailwind CSS compilation timeout (ms) - user can override via setting
export const TAILWIND_COMPILATION_TIMEOUT_DEFAULT_MS = 15000;

// -- debounce intervals --

// debounce delay for package.json watcher (ms) - uses shared standard
export const PACKAGE_JSON_WATCHER_DEBOUNCE_MS = STANDARD_WATCHER_DEBOUNCE_MS;

// default preview update debounce delay (ms) - uses shared standard
export const PREVIEW_DEBOUNCE_DELAY_DEFAULT_MS = STANDARD_DEBOUNCE_MS;

// error duplicate suppression window (ms)
export const ERROR_DEDUPE_WINDOW_DEFAULT_MS = 5000;

// -- limits --

// maximum file watchers for dependency tracking (LRU eviction)
export const DEP_WATCHER_MAX_ENTRIES = 50;

// maximum character length for fetch requests (security limit)
export const MAX_FETCH_REQUEST_LENGTH = 2048;

// maximum entries in error deduplication map before FIFO eviction
export const ERROR_DEDUPE_MAX_ENTRIES = 1000;

// -- caching --

// enhanced-resolve cached file system TTL (ms) - 30s is safe since
// cache is cleared on package.json changes & manual refresh
export const RESOLVER_CACHE_TTL_MS = 30000;

// -- ui --

// status bar item priority for trust indicator (higher = more left)
export const STATUS_BAR_TRUST_PRIORITY = 100;

// status bar item priority for framework indicator
export const STATUS_BAR_FRAMEWORK_PRIORITY = 99;

// character limit for CSP debug log preview
export const CSP_DEBUG_PREVIEW_LENGTH = 100;
