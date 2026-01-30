// packages/extension/types/vscode/csp.ts
// type definitions for Content Security Policy configuration

import type * as vscode from 'vscode';

// security policy selection for CSP (strict or disabled)
export const enum SecurityPolicy {
  Strict = 'strict',
  Disabled = 'disabled',
}

// options for CSP generation
export interface CSPOptions {
  webview: vscode.Webview;
  nonce: string;
  allowUnsafeEval: boolean;
}
