// packages/contracts/src/preview/types.ts
// shared preview types for extension & webview packages

import type { ModuleErrorData } from '../errors';

// fetch result w/ module code & dependencies
export interface FetchResult {
  fsPath: string;
  code: string;
  dependencies: string[];
  css?: string;
}

// trust state between extension & webview
export interface TrustState {
  workspaceTrusted: boolean;
  scriptsEnabled: boolean;
  canExecute: boolean;
  reason?: string;
  openMdxLinksInPreview: boolean;
}

// preview error w/ message & optional stack trace
export interface PreviewError {
  message: string;
  stack?: string;
  code?: string;
  // error context
  context?: string;
  // recoverable
  recoverable?: boolean;
  // module error data
  moduleError?: ModuleErrorData;
}

// check if value is a PreviewError
export function isPreviewError(value: unknown): value is PreviewError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof (value as PreviewError).message === 'string'
  );
}

// format trust state for debug logging
export function formatTrustStateForDebug(state: TrustState): string {
  return (
    `Trust state: canExecute=${state.canExecute}, ` +
    `workspaceTrusted=${state.workspaceTrusted}, ` +
    `scriptsEnabled=${state.scriptsEnabled}`
  );
}

// Nextra _meta.json page-level settings (preview-relevant only)
export interface NextraPageMeta {
  // title
  title?: string;
  // layout
  layout?: 'default' | 'full' | 'raw';
  // description
  description?: string;
  // toc visibility
  toc?: boolean;
}
