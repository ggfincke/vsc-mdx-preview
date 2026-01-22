// packages/extension/security/validateTrust.ts
// centralized trust validation utilities for trust-gated operations

import * as vscode from 'vscode';
import { SecurityMode } from './TrustManager';
import { getTrustManager } from '../services';
import type { TrustState } from '@mdx-preview/shared';

// custom error for trust validation failures
// thrown when an operation requires Trusted Mode but current state is Safe Mode
export class TrustError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TrustError';
  }
}

// check if Trusted Mode is currently enabled
// convenience wrapper for getTrustManager().canExecute()
export function isTrustedModeEnabled(): boolean {
  return getTrustManager().canExecute();
}

// check if current security mode is Trusted
// use this when you need to check against SecurityMode enum
export function isSecurityModeTrusted(): boolean {
  return getTrustManager().getMode() === SecurityMode.Trusted;
}

// require Trusted Mode for an operation - throws TrustError if not in Trusted Mode
// use for trust-gated operations that should fail loudly
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
// includes additional checks for remote environment & document scheme
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
