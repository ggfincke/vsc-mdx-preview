// packages/webview-app/src/rpc/handler-configs.ts
// Declarative configurations for RPC handler methods

import type { TrustState, PreviewError } from '@mdx-preview/shared';
import type {
  QueuedHandlerConfig,
  OptionalHandlerConfig,
} from './handler-factory';

// ============================================================================
// QUEUED Handler Configurations
// These handlers buffer messages until React mounts, then flush to state handlers
// ============================================================================

// configuration for setTrustState handler
export const SET_TRUST_STATE_CONFIG: QueuedHandlerConfig<
  TrustState,
  [TrustState]
> = {
  methodName: 'setTrustState',
  messageType: 'trust',
  handlerKey: 'setTrustState',
  toPayload: (state: unknown) => state as TrustState,
  toHandlerArgs: (payload) => [payload],
};

// payload type for updatePreview
interface TrustedPayload {
  code: string;
  entryFilePath: string;
  dependencies: string[];
}

// configuration for updatePreview handler (Trusted Mode w/ compiled code)
export const UPDATE_PREVIEW_CONFIG: QueuedHandlerConfig<
  TrustedPayload,
  [string, string, string[]]
> = {
  methodName: 'updatePreview',
  messageType: 'trusted',
  handlerKey: 'setTrustedContent',
  toPayload: (
    code: unknown,
    entryFilePath: unknown,
    entryFileDependencies: unknown
  ) => ({
    code: code as string,
    entryFilePath: entryFilePath as string,
    dependencies: entryFileDependencies as string[],
  }),
  toHandlerArgs: (payload) => [
    payload.code,
    payload.entryFilePath,
    payload.dependencies,
  ],
  debugFormat: (code: unknown, entryFilePath: unknown) =>
    `updatePreview called, code length: ${(code as string).length}, path: ${entryFilePath}`,
};

// payload type for updatePreviewSafe
interface SafePayload {
  html: string;
}

// configuration for updatePreviewSafe handler (Safe Mode w/ sanitized HTML)
export const UPDATE_PREVIEW_SAFE_CONFIG: QueuedHandlerConfig<
  SafePayload,
  [string]
> = {
  methodName: 'updatePreviewSafe',
  messageType: 'safe',
  handlerKey: 'setSafeContent',
  toPayload: (html: unknown) => ({ html: html as string }),
  toHandlerArgs: (payload) => [payload.html],
  debugFormat: (html: unknown) =>
    `updatePreviewSafe called, html length: ${(html as string).length}`,
};

// configuration for showPreviewError handler
export const SHOW_PREVIEW_ERROR_CONFIG: QueuedHandlerConfig<
  PreviewError,
  [PreviewError]
> = {
  methodName: 'showPreviewError',
  messageType: 'error',
  handlerKey: 'setError',
  toPayload: (error: unknown) => error as PreviewError,
  toHandlerArgs: (payload) => [payload],
};

// configuration for setStale handler
export const SET_STALE_CONFIG: QueuedHandlerConfig<boolean, [boolean]> = {
  methodName: 'setStale',
  messageType: 'stale',
  handlerKey: 'setStale',
  toPayload: (isStale: unknown) => isStale as boolean,
  toHandlerArgs: (payload) => [payload],
  debugFormat: (isStale: unknown) => `setStale called: ${isStale}`,
};

// ============================================================================
// OPTIONAL Handler Configurations
// These handlers call the optional handler if present, no queuing
// ============================================================================

// configuration for setTheme handler
export const SET_THEME_CONFIG: OptionalHandlerConfig = {
  methodName: 'setTheme',
  handlerKey: 'setTheme',
};

// configuration for setNextraMeta handler
export const SET_NEXTRA_META_CONFIG: OptionalHandlerConfig = {
  methodName: 'setNextraMeta',
  handlerKey: 'setNextraMeta',
};

// configuration for zoomIn handler
export const ZOOM_IN_CONFIG: OptionalHandlerConfig = {
  methodName: 'zoomIn',
  handlerKey: 'zoomIn',
};

// configuration for zoomOut handler
export const ZOOM_OUT_CONFIG: OptionalHandlerConfig = {
  methodName: 'zoomOut',
  handlerKey: 'zoomOut',
};

// configuration for resetZoom handler
export const RESET_ZOOM_CONFIG: OptionalHandlerConfig = {
  methodName: 'resetZoom',
  handlerKey: 'resetZoom',
};

// ============================================================================
// Config Collections (for iteration/documentation)
// ============================================================================

// all QUEUED handler configurations
export const QUEUED_CONFIGS = {
  setTrustState: SET_TRUST_STATE_CONFIG,
  updatePreview: UPDATE_PREVIEW_CONFIG,
  updatePreviewSafe: UPDATE_PREVIEW_SAFE_CONFIG,
  showPreviewError: SHOW_PREVIEW_ERROR_CONFIG,
  setStale: SET_STALE_CONFIG,
} as const;

/**
 * All OPTIONAL handler configurations.
 */
export const OPTIONAL_CONFIGS = {
  setTheme: SET_THEME_CONFIG,
  setNextraMeta: SET_NEXTRA_META_CONFIG,
  zoomIn: ZOOM_IN_CONFIG,
  zoomOut: ZOOM_OUT_CONFIG,
  resetZoom: RESET_ZOOM_CONFIG,
} as const;
