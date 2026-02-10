// tests/security/CSP.test.ts
// Unit tests for Content Security Policy generation

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode module
vi.mock('vscode', () => ({
  // Minimal mock - CSP.ts only uses vscode.Webview type
}));

// Import after mock
import {
  generateNonce,
  generateCSP,
  getCSP,
} from '../../packages/extension-host/src/features/security/CSP';
import { SecurityPolicy } from '../../packages/extension-host/src/features/security/security';
import type { TrustState } from '../../packages/extension-host/src/features/security/TrustManager';

// Mock webview for testing
const createMockWebview = () => ({
  cspSource: 'https://file+.vscode-resource.vscode-cdn.net',
  html: '',
  options: {},
  onDidReceiveMessage: vi.fn(),
  postMessage: vi.fn(),
  asWebviewUri: vi.fn(),
});

describe('generateNonce()', () => {
  it('produces 32-character hex string', () => {
    const nonce = generateNonce();

    expect(nonce).toHaveLength(32);
    expect(/^[0-9a-f]+$/.test(nonce)).toBe(true);
  });

  it('produces unique values on each call', () => {
    const nonces = new Set<string>();

    for (let i = 0; i < 100; i++) {
      const nonce = generateNonce();
      expect(nonces.has(nonce)).toBe(false);
      nonces.add(nonce);
    }

    expect(nonces.size).toBe(100);
  });
});

describe('generateCSP()', () => {
  let mockWebview: ReturnType<typeof createMockWebview>;

  beforeEach(() => {
    mockWebview = createMockWebview();
  });

  it('includes unsafe-eval when allowUnsafeEval: true', () => {
    const csp = generateCSP({
      webview: mockWebview as any,
      nonce: 'test-nonce-123',
      allowUnsafeEval: true,
    });

    expect(csp).toContain("'unsafe-eval'");
  });

  it('excludes unsafe-eval when allowUnsafeEval: false', () => {
    const csp = generateCSP({
      webview: mockWebview as any,
      nonce: 'test-nonce-123',
      allowUnsafeEval: false,
    });

    expect(csp).not.toContain("'unsafe-eval'");
  });

  it('includes nonce in script-src', () => {
    const nonce = 'abc123def456';
    const csp = generateCSP({
      webview: mockWebview as any,
      nonce,
      allowUnsafeEval: false,
    });

    expect(csp).toContain(`'nonce-${nonce}'`);
  });

  it('includes webview cspSource', () => {
    const csp = generateCSP({
      webview: mockWebview as any,
      nonce: 'test-nonce',
      allowUnsafeEval: false,
    });

    expect(csp).toContain(mockWebview.cspSource);
  });

  it("sets default-src to 'none'", () => {
    const csp = generateCSP({
      webview: mockWebview as any,
      nonce: 'test-nonce',
      allowUnsafeEval: false,
    });

    expect(csp).toContain("default-src 'none'");
  });

  it('includes required directives', () => {
    const csp = generateCSP({
      webview: mockWebview as any,
      nonce: 'test-nonce',
      allowUnsafeEval: false,
    });

    expect(csp).toContain('default-src');
    expect(csp).toContain('img-src');
    expect(csp).toContain('style-src');
    expect(csp).toContain('script-src');
    expect(csp).toContain('connect-src');
    expect(csp).toContain('font-src');
  });

  it('allows data: URIs for images', () => {
    const csp = generateCSP({
      webview: mockWebview as any,
      nonce: 'test-nonce',
      allowUnsafeEval: false,
    });

    expect(csp).toMatch(/img-src[^;]*data:/);
  });

  it('allows https: for images', () => {
    const csp = generateCSP({
      webview: mockWebview as any,
      nonce: 'test-nonce',
      allowUnsafeEval: false,
    });

    expect(csp).toMatch(/img-src[^;]*https:/);
  });

  it("allows 'unsafe-inline' for styles", () => {
    const csp = generateCSP({
      webview: mockWebview as any,
      nonce: 'test-nonce',
      allowUnsafeEval: false,
    });

    expect(csp).toMatch(/style-src[^;]*'unsafe-inline'/);
  });

  it('includes connect-src for webview origin', () => {
    const csp = generateCSP({
      webview: mockWebview as any,
      nonce: 'test-nonce',
      allowUnsafeEval: false,
    });

    expect(csp).toMatch(/connect-src[^;]*https:\/\/file\+\.vscode-resource/);
  });

  it('includes custom connect-src origins when provided', () => {
    const csp = generateCSP({
      webview: mockWebview as any,
      nonce: 'test-nonce',
      allowUnsafeEval: false,
      connectSrc: ['https://kroki.io'],
    });

    expect(csp).toMatch(/connect-src[^;]*https:\/\/kroki\.io/);
  });
});

describe('getCSP()', () => {
  let mockWebview: ReturnType<typeof createMockWebview>;

  beforeEach(() => {
    mockWebview = createMockWebview();
  });

  it('returns empty string when SecurityPolicy.Disabled', () => {
    const trustState: TrustState = {
      workspaceTrusted: true,
      scriptsEnabled: true,
      canExecute: true,
      openMdxLinksInPreview: true,
    };

    const csp = getCSP(
      mockWebview as any,
      'test-nonce',
      trustState,
      SecurityPolicy.Disabled
    );

    expect(csp).toBe('');
  });

  it('defaults to Strict policy when not specified', () => {
    const trustState: TrustState = {
      workspaceTrusted: true,
      scriptsEnabled: true,
      canExecute: true,
      openMdxLinksInPreview: true,
    };

    const csp = getCSP(mockWebview as any, 'test-nonce', trustState);

    expect(csp).not.toBe('');
    expect(csp).toContain("default-src 'none'");
  });

  it('includes unsafe-eval when trust state allows execution', () => {
    const trustState: TrustState = {
      workspaceTrusted: true,
      scriptsEnabled: true,
      canExecute: true,
      openMdxLinksInPreview: true,
    };

    const csp = getCSP(
      mockWebview as any,
      'test-nonce',
      trustState,
      SecurityPolicy.Strict
    );

    expect(csp).toContain("'unsafe-eval'");
  });

  it('excludes unsafe-eval when trust state blocks execution', () => {
    const trustState: TrustState = {
      workspaceTrusted: false,
      scriptsEnabled: true,
      canExecute: false,
      openMdxLinksInPreview: true,
    };

    const csp = getCSP(
      mockWebview as any,
      'test-nonce',
      trustState,
      SecurityPolicy.Strict
    );

    expect(csp).not.toContain("'unsafe-eval'");
  });

  it('uses canExecute to determine unsafe-eval', () => {
    // canExecute: true - should have unsafe-eval
    const trustedState: TrustState = {
      workspaceTrusted: true,
      scriptsEnabled: true,
      canExecute: true,
      openMdxLinksInPreview: true,
    };

    const trustedCsp = getCSP(mockWebview as any, 'nonce1', trustedState);
    expect(trustedCsp).toContain("'unsafe-eval'");

    // canExecute: false - should NOT have unsafe-eval
    const safeState: TrustState = {
      workspaceTrusted: true,
      scriptsEnabled: false,
      canExecute: false,
      openMdxLinksInPreview: true,
    };

    const safeCsp = getCSP(mockWebview as any, 'nonce2', safeState);
    expect(safeCsp).not.toContain("'unsafe-eval'");
  });

  it('does not include external origins in connect-src by default', () => {
    const trustState: TrustState = {
      workspaceTrusted: true,
      scriptsEnabled: true,
      canExecute: true,
      openMdxLinksInPreview: true,
    };

    const csp = getCSP(
      mockWebview as any,
      'test-nonce',
      trustState,
      SecurityPolicy.Strict
    );

    // connect-src should only contain the webview cspSource
    expect(csp).toMatch(/connect-src\s+https:\/\/file\+\.vscode-resource/);
    expect(csp).not.toMatch(/connect-src[^;]*kroki/);
  });
});
