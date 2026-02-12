// packages/extension/security/validateTrust.ts
// centralized trust validation utilities for trust-gated operations

import * as vscode from 'vscode';
import { SecurityMode } from './TrustManager';
import { getTrustManager } from '../../app/services';
import type { TrustState } from '@mdx-preview/contracts';

// error thrown when an operation requires Trusted Mode but the current state is Safe Mode
export class TrustError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TrustError';
  }
}

// check if Trusted Mode is currently enabled
export function isTrustedModeEnabled(): boolean {
  return getTrustManager().canExecute();
}

// check if current security mode is Trusted
export function isSecurityModeTrusted(): boolean {
  return getTrustManager().getMode() === SecurityMode.Trusted;
}

// require Trusted Mode for an operation - throw TrustError if not in Trusted Mode
export function requireTrustedMode(operation: string): TrustState {
  const trustState = getTrustManager().getState();
  if (!trustState.canExecute) {
    throw new TrustError(
      `Operation blocked: ${operation} requires Trusted Mode`
    );
  }
  return trustState;
}

// require Trusted Mode for a document-specific operation
export function requireTrustedModeForDocument(
  docUri: vscode.Uri,
  operation: string
): TrustState {
  const trustState = getTrustManager().getStateForDocument(docUri);
  if (!trustState.canExecute) {
    throw new TrustError(
      `Operation blocked: ${operation} requires Trusted Mode` +
        (trustState.reason ? ` (${trustState.reason})` : '')
    );
  }
  return trustState;
}

// run trust guard w/ optional TrustError callback
function tryRequire<T>(
  guard: () => T,
  onTrustError?: (error: TrustError) => void
): T | undefined {
  try {
    return guard();
  } catch (error: unknown) {
    if (error instanceof TrustError) {
      onTrustError?.(error);
      return undefined;
    }
    throw error;
  }
}

// non-throwing trust check for document-specific operations
// return TrustState on success, undefined on TrustError
// invoke optional callback w/ error before returning undefined
// rethrow non-TrustError exceptions
export function tryRequireTrustedModeForDocument(
  docUri: vscode.Uri,
  operation: string,
  onTrustError?: (error: TrustError) => void
): TrustState | undefined {
  return tryRequire(
    () => requireTrustedModeForDocument(docUri, operation),
    onTrustError
  );
}

// non-throwing trust check for general operations
// return TrustState on success, undefined on TrustError
// invoke optional callback w/ error before returning undefined
// rethrow non-TrustError exceptions
export function tryRequireTrustedMode(
  operation: string,
  onTrustError?: (error: TrustError) => void
): TrustState | undefined {
  return tryRequire(() => requireTrustedMode(operation), onTrustError);
}
