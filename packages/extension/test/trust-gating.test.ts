// packages/extension/test/trust-gating.test.ts
// tests for document-specific trust validation (canUseTrustedMode, getStateForDocument)

import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import {
  __setMockTrusted,
  __setMockConfig,
  __setMockRemoteName,
  __resetMocks,
  __getMockConfig,
  Uri,
} from './__mocks__/vscode';
import { TrustManager } from '../security/TrustManager';
import { ServiceRegistry } from '../services/ServiceRegistry';
import { ServiceNames } from '../services/service-names';

// mock getConfigManager to use vscode mock's config store
vi.mock('../services', async (importOriginal) => {
  const original = await importOriginal<typeof import('../services')>();
  return {
    ...original,
    getConfigManager: () => ({
      get: (key: string) => {
        return __getMockConfig(key) ?? false;
      },
      set: vi.fn(),
    }),
  };
});

// reset TrustManager singleton between tests
const resetTrustManager = (): void => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (TrustManager as any).instance = undefined;
};

describe('TrustManager document-specific checks', () => {
  beforeEach(() => {
    __resetMocks();
    resetTrustManager();
    ServiceRegistry.reset();

    // register TrustManager w/ ServiceRegistry
    const registry = ServiceRegistry.getInstance();
    registry.register(ServiceNames.TRUST_MANAGER, () =>
      TrustManager.getInstance()
    );
  });

  afterEach(() => {
    try {
      TrustManager.getInstance().dispose();
    } catch {
      // ignore if already disposed
    }
    resetTrustManager();
    ServiceRegistry.reset();
    __resetMocks();
  });

  describe('canUseTrustedMode', () => {
    describe('Rule 1: Workspace trust', () => {
      test('returns false when workspace is not trusted', () => {
        __setMockTrusted(false);
        __setMockConfig('preview.enableScripts', true);

        const manager = TrustManager.getInstance();
        const result = manager.canUseTrustedMode(Uri.file('/test.mdx'));

        expect(result.allowed).toBe(false);
      });

      test('returns reason explaining workspace trust requirement', () => {
        __setMockTrusted(false);
        __setMockConfig('preview.enableScripts', true);

        const manager = TrustManager.getInstance();
        const result = manager.canUseTrustedMode(Uri.file('/test.mdx'));

        expect(result.reason).toBeDefined();
        expect(result.reason).toContain('trust');
      });
    });

    describe('Rule 2: Scripts enabled', () => {
      test('returns false when scripts disabled', () => {
        __setMockTrusted(true);
        __setMockConfig('preview.enableScripts', false);

        const manager = TrustManager.getInstance();
        const result = manager.canUseTrustedMode(Uri.file('/test.mdx'));

        expect(result.allowed).toBe(false);
      });

      test('returns reason explaining scripts setting', () => {
        __setMockTrusted(true);
        __setMockConfig('preview.enableScripts', false);

        const manager = TrustManager.getInstance();
        const result = manager.canUseTrustedMode(Uri.file('/test.mdx'));

        expect(result.reason).toBeDefined();
        expect(result.reason).toContain('Scripts');
      });
    });

    describe('Rule 3: Remote environment', () => {
      test('returns false in remote environment', () => {
        __setMockTrusted(true);
        __setMockConfig('preview.enableScripts', true);
        __setMockRemoteName('ssh-remote');

        const manager = TrustManager.getInstance();
        const result = manager.canUseTrustedMode(Uri.file('/test.mdx'));

        expect(result.allowed).toBe(false);
      });

      test('includes remote name in reason', () => {
        __setMockTrusted(true);
        __setMockConfig('preview.enableScripts', true);
        __setMockRemoteName('wsl');

        const manager = TrustManager.getInstance();
        const result = manager.canUseTrustedMode(Uri.file('/test.mdx'));

        expect(result.reason).toBeDefined();
        expect(result.reason).toContain('Remote');
        expect(result.reason).toContain('wsl');
      });

      test('returns true for local workspace (no remoteName)', () => {
        __setMockTrusted(true);
        __setMockConfig('preview.enableScripts', true);
        __setMockRemoteName(undefined);

        const manager = TrustManager.getInstance();
        const result = manager.canUseTrustedMode(Uri.file('/test.mdx'));

        expect(result.allowed).toBe(true);
      });

      test('detects SSH remote', () => {
        __setMockTrusted(true);
        __setMockConfig('preview.enableScripts', true);
        __setMockRemoteName('ssh-remote');

        const manager = TrustManager.getInstance();
        const result = manager.canUseTrustedMode(Uri.file('/test.mdx'));

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('ssh-remote');
      });

      test('detects Dev Container remote', () => {
        __setMockTrusted(true);
        __setMockConfig('preview.enableScripts', true);
        __setMockRemoteName('dev-container');

        const manager = TrustManager.getInstance();
        const result = manager.canUseTrustedMode(Uri.file('/test.mdx'));

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('dev-container');
      });
    });

    describe('Rule 4: Document scheme', () => {
      test('returns true for file: scheme', () => {
        __setMockTrusted(true);
        __setMockConfig('preview.enableScripts', true);

        const manager = TrustManager.getInstance();
        const docUri = Uri.file('/workspace/test.mdx');
        const result = manager.canUseTrustedMode(docUri);

        expect(result.allowed).toBe(true);
      });

      test('returns true for untitled: scheme', () => {
        __setMockTrusted(true);
        __setMockConfig('preview.enableScripts', true);

        const manager = TrustManager.getInstance();
        // Create an untitled URI by modifying the scheme
        const docUri = {
          scheme: 'untitled',
          fsPath: 'Untitled-1',
          path: 'Untitled-1',
        } as any;
        const result = manager.canUseTrustedMode(docUri);

        expect(result.allowed).toBe(true);
      });

      test('returns false for non-file scheme', () => {
        __setMockTrusted(true);
        __setMockConfig('preview.enableScripts', true);

        const manager = TrustManager.getInstance();
        // Create a vscode-remote URI
        const docUri = {
          scheme: 'vscode-remote',
          fsPath: '/test.mdx',
          path: '/test.mdx',
        } as any;
        const result = manager.canUseTrustedMode(docUri);

        expect(result.allowed).toBe(false);
      });

      test('includes scheme in rejection reason', () => {
        __setMockTrusted(true);
        __setMockConfig('preview.enableScripts', true);

        const manager = TrustManager.getInstance();
        const docUri = {
          scheme: 'https',
          fsPath: '/test.mdx',
          path: '/test.mdx',
        } as any;
        const result = manager.canUseTrustedMode(docUri);

        expect(result.allowed).toBe(false);
        expect(result.reason).toBeDefined();
        expect(result.reason).toContain('https');
      });
    });

    describe('Combined rules', () => {
      test('returns true when all rules pass', () => {
        __setMockTrusted(true);
        __setMockConfig('preview.enableScripts', true);
        __setMockRemoteName(undefined);

        const manager = TrustManager.getInstance();
        const result = manager.canUseTrustedMode(
          Uri.file('/workspace/test.mdx')
        );

        expect(result.allowed).toBe(true);
        expect(result.reason).toBeUndefined();
      });

      test('checks rules in order: workspace trust first', () => {
        __setMockTrusted(false);
        __setMockConfig('preview.enableScripts', false);
        __setMockRemoteName('ssh-remote');

        const manager = TrustManager.getInstance();
        const result = manager.canUseTrustedMode(Uri.file('/test.mdx'));

        expect(result.allowed).toBe(false);
        // Should fail on workspace trust first
        expect(result.reason).toContain('trust');
      });
    });
  });

  describe('getStateForDocument', () => {
    test('returns base state when all checks pass', () => {
      __setMockTrusted(true);
      __setMockConfig('preview.enableScripts', true);
      __setMockRemoteName(undefined);

      const manager = TrustManager.getInstance();
      const result = manager.getStateForDocument(Uri.file('/test.mdx'));

      expect(result.canExecute).toBe(true);
      expect(result.workspaceTrusted).toBe(true);
      expect(result.scriptsEnabled).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    test('sets canExecute=false for remote documents', () => {
      __setMockTrusted(true);
      __setMockConfig('preview.enableScripts', true);
      __setMockRemoteName('ssh-remote');

      const manager = TrustManager.getInstance();
      const result = manager.getStateForDocument(Uri.file('/test.mdx'));

      expect(result.canExecute).toBe(false);
      // But workspace trust and scripts should still be true
      expect(result.workspaceTrusted).toBe(true);
      expect(result.scriptsEnabled).toBe(true);
    });

    test('includes reason from canUseTrustedMode', () => {
      __setMockTrusted(true);
      __setMockConfig('preview.enableScripts', true);
      __setMockRemoteName('wsl');

      const manager = TrustManager.getInstance();
      const result = manager.getStateForDocument(Uri.file('/test.mdx'));

      expect(result.canExecute).toBe(false);
      expect(result.reason).toBeDefined();
      expect(result.reason).toContain('Remote');
    });

    test('propagates workspace and scripts state', () => {
      __setMockTrusted(true);
      __setMockConfig('preview.enableScripts', false);

      const manager = TrustManager.getInstance();
      const result = manager.getStateForDocument(Uri.file('/test.mdx'));

      expect(result.workspaceTrusted).toBe(true);
      expect(result.scriptsEnabled).toBe(false);
      expect(result.canExecute).toBe(false);
    });

    test('sets canExecute=false for non-file scheme', () => {
      __setMockTrusted(true);
      __setMockConfig('preview.enableScripts', true);

      const manager = TrustManager.getInstance();
      const docUri = {
        scheme: 'vscode-remote',
        fsPath: '/test.mdx',
        path: '/test.mdx',
      } as any;
      const result = manager.getStateForDocument(docUri);

      expect(result.canExecute).toBe(false);
      expect(result.reason).toBeDefined();
    });
  });
});
