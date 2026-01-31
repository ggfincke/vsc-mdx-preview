// packages/extension/types/vscode/csp.ts
// type definitions for Content Security Policy configuration

import type * as vscode from 'vscode';

// Re-export SecurityPolicy from its canonical source
// Note: Defined in security/security.ts to avoid circular imports
export { SecurityPolicy } from '../../security/security';

// options for CSP generation
export interface CSPOptions {
  webview: vscode.Webview;
  nonce: string;
  allowUnsafeEval: boolean;
}
