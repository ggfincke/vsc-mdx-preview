// packages/extension/test/validateTrust.test.ts
// unit tests for trust validation utilities

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  __setMockTrusted,
  __setMockConfig,
  __resetMocks,
  __getMockConfig,
  Uri,
} from './__mocks__/vscode';
import {
  isTrustedModeEnabled,
  isSecurityModeTrusted,
  requireTrustedMode,
  requireTrustedModeForDocument,
  TrustError,
} from '../security/validateTrust';
import { TrustManager } from '../security/TrustManager';
import { ServiceRegistry } from '../services/ServiceRegistry';
import { ServiceNames } from '../services/service-names';

// mock getConfigManager to use vscode mock's config store
vi.mock('../services', async (importOriginal) => {
  const original = await importOriginal<typeof import('../services')>();
  return {
    ...original,
    getConfigManager: () => ({
      get: (key: string, scope?: unknown) => {
        return __getMockConfig(key) ?? false;
      },
      set: vi.fn(),
    }),
  };
});

// reset TrustManager singleton between tests (same pattern as TrustManager.test.ts)
const resetTrustManager = (): void => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (TrustManager as any).instance = undefined;
};

describe('validateTrust', () => {
  beforeEach(() => {
    // Reset mocks FIRST so config values are set before TrustManager reads them
    __resetMocks();

    // Reset singletons
    resetTrustManager();
    ServiceRegistry.reset();

    // register TrustManager factory w/ ServiceRegistry
    const registry = ServiceRegistry.getInstance();
    registry.register(ServiceNames.TRUST_MANAGER, () => TrustManager.getInstance());
  });

  afterEach(() => {
    // Clean up TrustManager
    try {
      TrustManager.getInstance().dispose();
    } catch {
      // Ignore if already disposed
    }
    resetTrustManager();
    ServiceRegistry.reset();
    __resetMocks();
  });

  describe('isTrustedModeEnabled', () => {
    it('returns false when workspace is untrusted', () => {
      __setMockTrusted(false);
      __setMockConfig('preview.enableScripts', true);

      expect(isTrustedModeEnabled()).toBe(false);
    });

    it('returns false when scripts are disabled', () => {
      __setMockTrusted(true);
      __setMockConfig('preview.enableScripts', false);

      expect(isTrustedModeEnabled()).toBe(false);
    });

    it('returns true when workspace is trusted AND scripts enabled', () => {
      __setMockTrusted(true);
      __setMockConfig('preview.enableScripts', true);

      expect(isTrustedModeEnabled()).toBe(true);
    });
  });

  describe('isSecurityModeTrusted', () => {
    it('returns false in Safe Mode', () => {
      __setMockTrusted(false);
      __setMockConfig('preview.enableScripts', false);

      expect(isSecurityModeTrusted()).toBe(false);
    });

    it('returns true in Trusted Mode', () => {
      __setMockTrusted(true);
      __setMockConfig('preview.enableScripts', true);

      expect(isSecurityModeTrusted()).toBe(true);
    });
  });

  describe('requireTrustedMode', () => {
    it('returns trust state when trusted', () => {
      __setMockTrusted(true);
      __setMockConfig('preview.enableScripts', true);

      const result = requireTrustedMode('test operation');

      expect(result).toBeDefined();
      expect(result.canExecute).toBe(true);
      expect(result.workspaceTrusted).toBe(true);
      expect(result.scriptsEnabled).toBe(true);
    });

    it('throws TrustError when not trusted', () => {
      __setMockTrusted(false);
      __setMockConfig('preview.enableScripts', false);

      expect(() => requireTrustedMode('test operation')).toThrow(TrustError);
      expect(() => requireTrustedMode('test operation')).toThrow(
        'Operation blocked: test operation requires Trusted Mode'
      );
    });

    it('throws TrustError when workspace trusted but scripts disabled', () => {
      __setMockTrusted(true);
      __setMockConfig('preview.enableScripts', false);

      expect(() => requireTrustedMode('fetch module')).toThrow(TrustError);
    });
  });

  describe('requireTrustedModeForDocument', () => {
    it('returns trust state for local file when trusted', () => {
      __setMockTrusted(true);
      __setMockConfig('preview.enableScripts', true);

      const docUri = Uri.file('/projects/test-workspace/test.mdx');
      const result = requireTrustedModeForDocument(docUri, 'render preview');

      expect(result).toBeDefined();
      expect(result.canExecute).toBe(true);
    });

    it('throws TrustError for local file when not trusted', () => {
      __setMockTrusted(false);
      __setMockConfig('preview.enableScripts', false);

      const docUri = Uri.file('/projects/test-workspace/test.mdx');

      expect(() =>
        requireTrustedModeForDocument(docUri, 'render preview')
      ).toThrow(TrustError);
    });
  });

  describe('TrustError', () => {
    it('has correct name property', () => {
      const error = new TrustError('test message');

      expect(error.name).toBe('TrustError');
      expect(error.message).toBe('test message');
    });

    it('is instanceof Error', () => {
      const error = new TrustError('test');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(TrustError);
    });
  });
});
