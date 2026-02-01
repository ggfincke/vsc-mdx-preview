// packages/extension/security/validateTrust.ts
// centralized trust validation utilities for trust-gated operations
//
// WHEN TO USE THIS MODULE vs TrustManager DIRECTLY
//
// Use validateTrust utilities when
// - You want to THROW on trust failure (fail-fast pattern)
// - The operation cannot proceed at all w/o trust (e.g., loading plugins)
// - You want the error to propagate up w/ a descriptive message
//
// Use TrustManager.getState() directly when
// - You want to BRANCH based on trust state (conditional pattern)
// - You have a fallback behavior for untrusted mode
// - You need to access the full TrustState object for UI display
// - You want to subscribe to trust state changes
//
// EXAMPLES
//
// Throwing pattern (use validateTrust)
// ```typescript
// async function loadPluginsFromConfig(configPath: string) {
//   requireTrustedMode('load custom MDX plugins');  // throws if not trusted
//   const plugins = await loadPlugins(configPath);
//   return plugins;
// }
// ```
//
// Conditional pattern (use TrustManager directly)
// ```typescript
// function compileDocument(doc: vscode.TextDocument) {
//   const { canExecute } = getTrustManager().getState();
//   if (canExecute) {
//     return compileToJavaScript(doc);  // Full React/JSX support
//   } else {
//     return compileToSafeHtml(doc);    // Static HTML fallback
//   }
// }
// ```
//
// Document-specific check (use requireTrustedModeForDocument)
// ```typescript
// async function fetchModule(specifier: string, docUri: vscode.Uri) {
//   requireTrustedModeForDocument(docUri, 'fetch & evaluate modules');
//   // Proceeds only if workspace is trusted & document is local
// }
// ```

import * as vscode from 'vscode';
import { SecurityMode } from './TrustManager';
import { getTrustManager } from '../services';
import type { TrustState } from '@mdx-preview/shared';

// error thrown when an operation requires Trusted Mode but the current state is Safe Mode
// catch this error to handle trust failures gracefully
// ```typescript
// try {
//   requireTrustedMode('execute user code');
//   executeCode();
// } catch (e) {
//   if (e instanceof TrustError) {
//     showSafeModeWarning();
//   } else {
//     throw e;
//   }
// }
// ```
export class TrustError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TrustError';
  }
}

// check if Trusted Mode is currently enabled
// convenience wrapper for `getTrustManager().canExecute()`
// use this for simple boolean checks where you don't need the full TrustState
// return true if code execution allowed (workspace trusted & enableScripts setting)
export function isTrustedModeEnabled(): boolean {
  return getTrustManager().canExecute();
}

// check if current security mode is Trusted
// use this when you need to compare against the SecurityMode enum directly,
// for example when logging or displaying the current mode
// return true if security mode is SecurityMode.Trusted
export function isSecurityModeTrusted(): boolean {
  return getTrustManager().getMode() === SecurityMode.Trusted;
}

// require Trusted Mode for an operation - throw TrustError if not in Trusted Mode
// use this for trust-gated operations that should fail loudly
// the operation description is included in the error message for debugging
// param operation - description of the operation being attempted (e.g., "load custom plugins")
// return current TrustState if trusted (for convenience chaining)
// throw TrustError if not in Trusted Mode
// example
// ```typescript
// function loadCustomConfig() {
//   requireTrustedMode('load custom MDX configuration');
//   // Only reached if trusted
//   return parseConfig();
// }
// ```
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
// include additional checks beyond basic trust state
// - Workspace trust must be granted
// - Document must be from a local file scheme (not remote)
// - Remote extension environments are blocked
// use this for operations that access the file system relative to a document,
// such as module fetching or dependency resolution
// param docUri - URI of the document being operated on
// param operation - description of the operation being attempted
// return current TrustState if trusted
// throw TrustError if not in Trusted Mode or document is from untrusted source
// example
// ```typescript
// async function fetchLocalModule(specifier: string, docUri: vscode.Uri) {
//   requireTrustedModeForDocument(docUri, 'fetch local module');
//   // Only reached if document is local & workspace is trusted
//   return await resolveAndLoad(specifier);
// }
// ```
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

// non-throwing trust check for document-specific operations
// return TrustState on success, undefined on TrustError
// call optional callback w/ error before returning undefined
// re-throw non-TrustError exceptions
export function tryRequireTrustedModeForDocument(
  docUri: vscode.Uri,
  operation: string,
  onTrustError?: (error: TrustError) => void
): TrustState | undefined {
  try {
    return requireTrustedModeForDocument(docUri, operation);
  } catch (error) {
    if (error instanceof TrustError) {
      onTrustError?.(error);
      return undefined;
    }
    throw error;
  }
}

// non-throwing trust check for general operations
// return TrustState on success, undefined on TrustError
// call optional callback w/ error before returning undefined
// re-throw non-TrustError exceptions
export function tryRequireTrustedMode(
  operation: string,
  onTrustError?: (error: TrustError) => void
): TrustState | undefined {
  try {
    return requireTrustedMode(operation);
  } catch (error) {
    if (error instanceof TrustError) {
      onTrustError?.(error);
      return undefined;
    }
    throw error;
  }
}
