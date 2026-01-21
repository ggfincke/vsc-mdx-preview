// packages/shared/constants.ts
// shared timing & limit constants for extension & webview packages

// standard debounce interval (ms) for preview updates, config watchers
export const STANDARD_DEBOUNCE_MS = 300;

// standard cache TTL (ms) - 5 minutes
export const STANDARD_CACHE_TTL_MS = 5 * 60 * 1000;

// standard watcher debounce interval (ms) for package.json, config changes
export const STANDARD_WATCHER_DEBOUNCE_MS = 500;
