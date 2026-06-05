// packages/extension-host/src/features/security/validateTrust.ts
// centralized trust validation utilities for trust-gated operations

import * as vscode from 'vscode';
import { getTrustManager } from '../../app/services';
import type { TrustState } from '@mdx-preview/contracts';

// error thrown when an operation requires Trusted Mode but the current state is Safe Mode
export class TrustError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TrustError';
  }
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

// require a trusted workspace for an operation - throw TrustError if untrusted
// checks ONLY workspaceTrusted (not canExecute/scriptsEnabled) by design
export function requireWorkspaceTrusted(operation: string): TrustState {
  const trustState = getTrustManager().getState();
  if (!trustState.workspaceTrusted) {
    throw new TrustError(
      `Operation blocked: ${operation} requires a trusted workspace`
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
// return TrustState or invoke callback & return undefined on TrustError
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
// return TrustState or invoke callback & return undefined on TrustError
export function tryRequireTrustedMode(
  operation: string,
  onTrustError?: (error: TrustError) => void
): TrustState | undefined {
  return tryRequire(() => requireTrustedMode(operation), onTrustError);
}

// non-throwing workspace-trust check
// return TrustState or invoke callback & return undefined on TrustError
export function tryRequireWorkspaceTrusted(
  operation: string,
  onTrustError?: (error: TrustError) => void
): TrustState | undefined {
  return tryRequire(() => requireWorkspaceTrusted(operation), onTrustError);
}
