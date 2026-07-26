// tests/security/CSP.test.ts
// verify representative CSP generation boundaries

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => ({}));

import {
  generateCSP,
  generateNonce,
  getCSP,
} from '../../packages/extension-host/src/features/security/CSP';
import type { TrustState } from '../../packages/extension-host/src/features/security/TrustManager';

function createMockWebview() {
  return {
    cspSource: 'https://file+.vscode-resource.vscode-cdn.net',
    html: '',
    options: {},
    onDidReceiveMessage: vi.fn(),
    postMessage: vi.fn(),
    asWebviewUri: vi.fn(),
  };
}

describe('CSP', () => {
  let mockWebview: ReturnType<typeof createMockWebview>;

  beforeEach(() => {
    mockWebview = createMockWebview();
  });

  it('generates distinct 32-character hexadecimal nonces', () => {
    const first = generateNonce();
    const second = generateNonce();

    expect(first).toHaveLength(32);
    expect(/^[0-9a-f]+$/.test(first)).toBe(true);
    expect(first).not.toBe(second);
  });

  it('includes unsafe-eval when explicitly enabled', () => {
    const csp = generateCSP({
      webview: mockWebview as never,
      nonce: 'test-nonce',
      allowUnsafeEval: true,
    });

    expect(csp).toContain("'unsafe-eval'");
  });

  it('omits unsafe-eval when explicitly disabled', () => {
    const csp = generateCSP({
      webview: mockWebview as never,
      nonce: 'test-nonce',
      allowUnsafeEval: false,
    });

    expect(csp).not.toContain("'unsafe-eval'");
  });

  it('returns an empty policy string when CSP is disabled', () => {
    const trustState: TrustState = {
      workspaceTrusted: true,
      scriptsEnabled: true,
      canExecute: true,
      openMdxLinksInPreview: true,
    };

    expect(
      getCSP(mockWebview as never, 'test-nonce', trustState, 'disabled')
    ).toBe('');
  });

  it('keeps connect-src scoped to the webview origin by default', () => {
    const trustState: TrustState = {
      workspaceTrusted: true,
      scriptsEnabled: true,
      canExecute: true,
      openMdxLinksInPreview: true,
    };

    const csp = getCSP(
      mockWebview as never,
      'test-nonce',
      trustState,
      'strict'
    );

    expect(csp).toMatch(/connect-src\s+https:\/\/file\+\.vscode-resource/);
    expect(csp).not.toMatch(/connect-src[^;]*kroki/);
  });
});
