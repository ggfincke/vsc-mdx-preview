// packages/extension/security/CSP.ts
// content security policy generation for Safe Mode (no eval) & Trusted Mode (w/ eval)

import * as vscode from 'vscode';
import type { TrustState } from './TrustManager';
import { SecurityPolicy } from './security';

// generate cryptographically secure nonce
export function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join(
    ''
  );
}

// options for CSP generation
export interface CSPOptions {
  webview: vscode.Webview;
  nonce: string;
  allowUnsafeEval: boolean;
}

// generate CSP string w/ configurable eval policy
export function generateCSP(options: CSPOptions): string {
  const { webview, nonce, allowUnsafeEval } = options;
  // include cspSource to allow dynamic chunk imports (e.g. mermaid)
  const scriptSrc = allowUnsafeEval
    ? `${webview.cspSource} 'nonce-${nonce}' 'unsafe-eval'`
    : `${webview.cspSource} 'nonce-${nonce}'`;

  return [
    "default-src 'none'",
    `img-src ${webview.cspSource} https: data:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src ${scriptSrc}`,
    `font-src ${webview.cspSource}`,
  ].join('; ');
}

// get appropriate CSP based on trust state & security settings
export function getCSP(
  webview: vscode.Webview,
  nonce: string,
  trustState: TrustState,
  securityPolicy: SecurityPolicy = SecurityPolicy.Strict
): string {
  // if user explicitly disabled CSP (not recommended)
  if (securityPolicy === SecurityPolicy.Disabled) {
    return '';
  }

  // only allow eval if workspace trusted & scripts enabled
  return generateCSP({
    webview,
    nonce,
    allowUnsafeEval: trustState.canExecute,
  });
}
