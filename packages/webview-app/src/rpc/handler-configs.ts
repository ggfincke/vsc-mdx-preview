// packages/webview-app/src/rpc/handler-configs.ts
// Declarative configurations for RPC handler methods

import type { TrustState, PreviewError } from '@mdx-preview/shared';
import type {
  QueuedHandlerConfig,
  OptionalHandlerConfig,
  QueuedMessageType,
} from './handler-factory';

// ============================================================================
// QUEUED Handler Configurations
// These handlers buffer messages until React mounts, then flush to state handlers
// ============================================================================

// factory for creating simple pass-through queued configs
// use for handlers where the payload is passed directly without transformation
function createSimpleQueuedConfig<T>(
  methodName: string,
  messageType: QueuedMessageType,
  handlerKey: keyof import('./handler-factory').RequiredStateHandlers,
  debugFormat?: (...args: unknown[]) => string
): QueuedHandlerConfig<T, [T]> {
  return {
    methodName,
    messageType,
    handlerKey,
    toPayload: (value: unknown) => value as T,
    toHandlerArgs: (payload) => [payload],
    debugFormat,
  };
}

// configuration for setTrustState handler
export const SET_TRUST_STATE_CONFIG = createSimpleQueuedConfig<TrustState>(
  'setTrustState',
  'trust',
  'setTrustState'
);

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
export const SHOW_PREVIEW_ERROR_CONFIG = createSimpleQueuedConfig<PreviewError>(
  'showPreviewError',
  'error',
  'setError'
);

// configuration for setStale handler
export const SET_STALE_CONFIG = createSimpleQueuedConfig<boolean>(
  'setStale',
  'stale',
  'setStale',
  (isStale: unknown) => `setStale called: ${isStale}`
);

// ============================================================================
// OPTIONAL Handler Configurations
// These handlers call the optional handler if present, no queuing
// ============================================================================

// factory for creating optional handler configs with identical methodName/handlerKey
function createOptionalConfig<K extends keyof import('./handler-factory').OptionalStateHandlers>(
  key: K
): OptionalHandlerConfig {
  return { methodName: key, handlerKey: key };
}

// configuration for setTheme handler
export const SET_THEME_CONFIG = createOptionalConfig('setTheme');

// configuration for setNextraMeta handler
export const SET_NEXTRA_META_CONFIG = createOptionalConfig('setNextraMeta');

// configuration for zoomIn handler
export const ZOOM_IN_CONFIG = createOptionalConfig('zoomIn');

// configuration for zoomOut handler
export const ZOOM_OUT_CONFIG = createOptionalConfig('zoomOut');

// configuration for resetZoom handler
export const RESET_ZOOM_CONFIG = createOptionalConfig('resetZoom');

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

// all OPTIONAL handler configurations
export const OPTIONAL_CONFIGS = {
  setTheme: SET_THEME_CONFIG,
  setNextraMeta: SET_NEXTRA_META_CONFIG,
  zoomIn: ZOOM_IN_CONFIG,
  zoomOut: ZOOM_OUT_CONFIG,
  resetZoom: RESET_ZOOM_CONFIG,
} as const;
