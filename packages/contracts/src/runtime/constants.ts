// packages/contracts/src/runtime/constants.ts
// shared timing & limit constants for extension & webview packages

// extension display name shown in notifications, output channel & status bar
export const EXTENSION_DISPLAY_NAME = 'MDX Preview';

// standard debounce interval (ms) for preview updates, config watchers
export const STANDARD_DEBOUNCE_MS = 300;

// standard cache TTL (ms) - 5 minutes
export const STANDARD_CACHE_TTL_MS = 5 * 60 * 1000;

// standard watcher debounce interval (ms) for package.json, config changes
export const STANDARD_WATCHER_DEBOUNCE_MS = 500;

// rpc handler retry configuration
// exponential backoff: 100, 200, 400, 800ms
export const RPC_HANDLER_RETRY_DELAY_MS = 100;

// max retry attempts
export const RPC_HANDLER_MAX_RETRIES = 4;

// max pending messages
export const RPC_PENDING_MESSAGES_WARNING_THRESHOLD = 50;

// shim loading retry configuration
// exponential backoff: 200, 400, 800ms
export const SHIM_LOAD_MAX_RETRIES = 3;

// base delay for shim loading retry (ms)
export const SHIM_LOAD_RETRY_DELAY_MS = 200;
