// packages/webview-app/src/constants.ts
// centralized constants for the webview app (consolidates magic numbers)

// zoom

// minimum zoom level percentage
export const ZOOM_MIN_PERCENT = 50;

// maximum zoom level percentage
export const ZOOM_MAX_PERCENT = 300;

// zoom increment/decrement step
export const ZOOM_STEP_PERCENT = 10;

// default zoom level (100% = no zoom)
export const ZOOM_DEFAULT_PERCENT = 100;

// ui feedback

// duration to show "copied" feedback after code copy (ms)
export const CODE_COPY_FEEDBACK_DURATION_MS = 2000;

// delay before showing loading bar to prevent flicker (ms)
export const LOADING_BAR_SHOW_DELAY_MS = 500;

// rpc & shim loading constants (re-exported from shared)
export {
  RPC_HANDLER_RETRY_DELAY_MS,
  RPC_HANDLER_MAX_RETRIES,
  RPC_PENDING_MESSAGES_WARNING_THRESHOLD,
  SHIM_LOAD_MAX_RETRIES,
  SHIM_LOAD_RETRY_DELAY_MS,
} from '@mdx-preview/shared';

// module loading limits (security & DoS prevention)

// maximum recursion depth for module loading
// prevents stack overflow from deep dependency chains
export const MAX_MODULE_LOAD_DEPTH = 100;

// maximum concurrent fetch requests
// prevents resource exhaustion from unbounded parallelism
export const MAX_CONCURRENT_FETCHES = 10;
