// packages/webview-app/src/constants.ts
// centralized constants for the webview app
//
// this file consolidates magic numbers from across the webview
// to improve maintainability & documentation.

// =============================================================================
// ZOOM
// =============================================================================

// minimum zoom level percentage
export const ZOOM_MIN_PERCENT = 50;

// maximum zoom level percentage
export const ZOOM_MAX_PERCENT = 300;

// zoom increment/decrement step
export const ZOOM_STEP_PERCENT = 10;

// default zoom level (100% = no zoom)
export const ZOOM_DEFAULT_PERCENT = 100;

// =============================================================================
// UI FEEDBACK
// =============================================================================

// duration to show "copied" feedback after code copy (ms)
export const CODE_COPY_FEEDBACK_DURATION_MS = 2000;

// delay before showing loading bar to prevent flicker (ms)
export const LOADING_BAR_SHOW_DELAY_MS = 500;

// =============================================================================
// RPC MESSAGE QUEUE
// =============================================================================

// base retry delay for handler registration failure (ms)
// handles rare case where React mount fails on first attempt
// K.3: used with exponential backoff (100, 200, 400, 800ms delays)
export const RPC_HANDLER_RETRY_DELAY_MS = 100;

// maximum retry attempts for handler registration
// K.3: 4 retries = 5 total attempts, ~1.5s total max wait before giving up
export const RPC_HANDLER_MAX_RETRIES = 4;

// maximum pending messages before logging a warning
// helps detect message accumulation issues during development
export const RPC_PENDING_MESSAGES_WARNING_THRESHOLD = 50;

// =============================================================================
// SHIM LOADING
// =============================================================================

// maximum retry attempts for shim loading failures
// O.3: framework shim loading can fail due to network issues or bundle errors
export const SHIM_LOAD_MAX_RETRIES = 3;

// base delay for shim loading retry (ms) - exponential backoff applied
// O.3: delays are 200ms, 400ms, 800ms for retries 1-3
export const SHIM_LOAD_RETRY_DELAY_MS = 200;
