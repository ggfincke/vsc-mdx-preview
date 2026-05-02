// packages/webview-client/src/app/constants.ts
// centralized constants for the webview app (consolidates magic numbers)

// ui feedback

// duration to show "copied" feedback after code copy (ms)
export const CODE_COPY_FEEDBACK_DURATION_MS = 2000;

// delay before showing loading bar to prevent flicker (ms)
export const LOADING_BAR_SHOW_DELAY_MS = 500;

// preview DOM class names — shared between App rendering and export pipeline
// so renaming either side does not silently break HTML export.
// CSS files (App.css, vscode-dark-adapter.css) hard-code these too;
// keep all four in sync.
export const PREVIEW_ROOT_CLASS = 'mdx-preview-container';
export const PREVIEW_CONTENT_CLASS = 'mdx-preview-content';

// rpc & shim loading constants (re-exported from shared)
export {
  RPC_HANDLER_MAX_RETRIES,
  RPC_HANDLER_RETRY_DELAY_MS,
  RPC_PENDING_MESSAGES_WARNING_THRESHOLD,
  SHIM_LOAD_MAX_RETRIES,
  SHIM_LOAD_RETRY_DELAY_MS,
} from '@mdx-preview/contracts';
