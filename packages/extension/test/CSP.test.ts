import { describe, test, expect } from 'vitest';
import { createMockWebview } from './__mocks__/vscode';
import { generateNonce, getCSP } from '../security/CSP';
import { SecurityPolicy } from '../security/security';
import type { TrustState } from '../security/TrustManager';

describe('CSP', () => {
  describe('generateNonce', () => {
    test('returns a 32-character hex string', () => {
      const nonce = generateNonce();
      expect(nonce).toMatch(/^[0-9a-f]{32}$/);
    });

    test('returns unique values on each call', () => {
      const nonce1 = generateNonce();
      const nonce2 = generateNonce();
      const nonce3 = generateNonce();

      expect(nonce1).not.toBe(nonce2);
      expect(nonce2).not.toBe(nonce3);
      expect(nonce1).not.toBe(nonce3);
    });

    test('returns string of correct length', () => {
      const nonce = generateNonce();
      expect(nonce.length).toBe(32);
    });
  });

  describe('getCSP', () => {
    const mockWebview = createMockWebview();
    const testNonce = 'abc123def456789012345678901234ab';

    describe('when canExecute is false (Safe Mode)', () => {
      const safeTrustState: TrustState = {
        workspaceTrusted: false,
        scriptsEnabled: false,
        canExecute: false,
      };

      test('does NOT include unsafe-eval', () => {
        const csp = getCSP(
          mockWebview as never,
          testNonce,
          safeTrustState,
          SecurityPolicy.Strict
        );

        expect(csp).not.toContain("'unsafe-eval'");
      });

      test('includes nonce-based script-src', () => {
        const csp = getCSP(
          mockWebview as never,
          testNonce,
          safeTrustState,
          SecurityPolicy.Strict
        );

        expect(csp).toContain(`'nonce-${testNonce}'`);
      });

      test('includes webview.cspSource in script-src for dynamic chunk loading', () => {
        const csp = getCSP(
          mockWebview as never,
          testNonce,
          safeTrustState,
          SecurityPolicy.Strict
        );

        expect(csp).toContain(`script-src ${mockWebview.cspSource}`);
      });

      test('includes default-src none', () => {
        const csp = getCSP(
          mockWebview as never,
          testNonce,
          safeTrustState,
          SecurityPolicy.Strict
        );

        expect(csp).toContain("default-src 'none'");
      });

      test('includes img-src with webview source', () => {
        const csp = getCSP(
          mockWebview as never,
          testNonce,
          safeTrustState,
          SecurityPolicy.Strict
        );

        expect(csp).toContain(`img-src ${mockWebview.cspSource}`);
        expect(csp).toContain('https:');
        expect(csp).toContain('data:');
      });

      test('includes style-src with unsafe-inline for styled-components', () => {
        const csp = getCSP(
          mockWebview as never,
          testNonce,
          safeTrustState,
          SecurityPolicy.Strict
        );

        expect(csp).toContain('style-src');
        expect(csp).toContain("'unsafe-inline'");
      });

      test('includes font-src with webview source', () => {
        const csp = getCSP(
          mockWebview as never,
          testNonce,
          safeTrustState,
          SecurityPolicy.Strict
        );

        expect(csp).toContain(`font-src ${mockWebview.cspSource}`);
      });
    });

    describe('when canExecute is true (Trusted Mode)', () => {
      const trustedState: TrustState = {
        workspaceTrusted: true,
        scriptsEnabled: true,
        canExecute: true,
      };

      test('includes unsafe-eval for module execution', () => {
        const csp = getCSP(
          mockWebview as never,
          testNonce,
          trustedState,
          SecurityPolicy.Strict
        );

        expect(csp).toContain("'unsafe-eval'");
      });

      test('still includes nonce-based script-src', () => {
        const csp = getCSP(
          mockWebview as never,
          testNonce,
          trustedState,
          SecurityPolicy.Strict
        );

        expect(csp).toContain(`'nonce-${testNonce}'`);
      });

      test('includes webview.cspSource in script-src for dynamic chunk loading', () => {
        const csp = getCSP(
          mockWebview as never,
          testNonce,
          trustedState,
          SecurityPolicy.Strict
        );

        expect(csp).toContain(`script-src ${mockWebview.cspSource}`);
      });

      test('includes default-src none', () => {
        const csp = getCSP(
          mockWebview as never,
          testNonce,
          trustedState,
          SecurityPolicy.Strict
        );

        expect(csp).toContain("default-src 'none'");
      });
    });

    describe('when SecurityPolicy.Disabled', () => {
      const trustedState: TrustState = {
        workspaceTrusted: true,
        scriptsEnabled: true,
        canExecute: true,
      };

      test('returns empty string', () => {
        const csp = getCSP(
          mockWebview as never,
          testNonce,
          trustedState,
          SecurityPolicy.Disabled
        );

        expect(csp).toBe('');
      });
    });

    describe('edge cases', () => {
      test('untrusted workspace but scripts enabled still returns strict CSP', () => {
        const state: TrustState = {
          workspaceTrusted: false,
          scriptsEnabled: true,
          canExecute: false,
        };

        const csp = getCSP(
          mockWebview as never,
          testNonce,
          state,
          SecurityPolicy.Strict
        );

        expect(csp).not.toContain("'unsafe-eval'");
      });

      test('trusted workspace but scripts disabled still returns strict CSP', () => {
        const state: TrustState = {
          workspaceTrusted: true,
          scriptsEnabled: false,
          canExecute: false,
        };

        const csp = getCSP(
          mockWebview as never,
          testNonce,
          state,
          SecurityPolicy.Strict
        );

        expect(csp).not.toContain("'unsafe-eval'");
      });

      test('default security policy is Strict', () => {
        const safeTrustState: TrustState = {
          workspaceTrusted: false,
          scriptsEnabled: false,
          canExecute: false,
        };

        // Call without security policy parameter
        const csp = getCSP(mockWebview as never, testNonce, safeTrustState);

        // Should behave as Strict (no eval)
        expect(csp).not.toContain("'unsafe-eval'");
        expect(csp).toContain("default-src 'none'");
      });
    });
  });
});
