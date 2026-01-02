// packages/extension/security/CSP.ts
// Content Security Policy generation for Safe Mode (no eval) & Trusted Mode (w/ eval)

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

// get Safe Mode CSP (no eval, used when workspace untrusted or scripts disabled)
function getStrictCSP(webview: vscode.Webview, nonce: string): string {
  return [
    "default-src 'none'",
    `img-src ${webview.cspSource} https: data:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`,
    `font-src ${webview.cspSource}`,
  ].join('; ');
}

// get Trusted Mode CSP (eval allowed for module execution, requires workspace trusted & scripts enabled)
function getTrustedCSP(webview: vscode.Webview, nonce: string): string {
  return [
    "default-src 'none'",
    `img-src ${webview.cspSource} https: data:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}' 'unsafe-eval'`,
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
  if (trustState.canExecute) {
    return getTrustedCSP(webview, nonce);
  }

  // default to strict CSP (no eval)
  return getStrictCSP(webview, nonce);
}
