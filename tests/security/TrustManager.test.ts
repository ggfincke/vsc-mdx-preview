// tests/security/TrustManager.test.ts
// Unit tests for TrustManager security system

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Define hoisted mocks BEFORE vi.mock() calls
const { mockWorkspace, mockEnv, mockConfigManager } = vi.hoisted(() => ({
  mockWorkspace: {
    isTrusted: true,
    onDidChangeWorkspaceTrust: vi.fn(() => ({ dispose: vi.fn() })),
    onDidGrantWorkspaceTrust: vi.fn(() => ({ dispose: vi.fn() })),
    onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
  },
  mockEnv: {
    remoteName: undefined as string | undefined,
  },
  mockConfigManager: {
    get: vi.fn((key: string) => {
      if (key === 'preview.enableScripts') return true;
      if (key === 'preview.openMdxLinksInPreview') return true;
      return undefined;
    }),
    onDidChangeKey: vi.fn(() => ({ dispose: vi.fn() })),
  },
}));

// Mock vscode module
vi.mock('vscode', () => ({
  workspace: mockWorkspace,
  env: mockEnv,
  Uri: {
    file: (path: string) => ({ scheme: 'file', fsPath: path, path }),
    parse: (uri: string) => {
      const url = new URL(uri);
      return {
        scheme: url.protocol.replace(':', ''),
        fsPath: url.pathname,
        path: url.pathname,
      };
    },
  },
}));

// Mock services
vi.mock('../../packages/extension-host/src/app/services', () => ({
  getConfigManager: () => mockConfigManager,
}));

// Import after mocks are set up
import {
  TrustManager,
  SecurityMode,
  getSecurityMode,
} from '../../packages/extension-host/src/features/security/TrustManager';
import type { TrustState } from '@mdx-preview/contracts';

describe('TrustManager', () => {
  let trustManager: TrustManager;

  beforeEach(() => {
    // Reset mocks to default values
    mockWorkspace.isTrusted = true;
    mockEnv.remoteName = undefined;
    mockConfigManager.get.mockImplementation((key: string) => {
      if (key === 'preview.enableScripts') return true;
      if (key === 'preview.openMdxLinksInPreview') return true;
      return undefined;
    });

    // Get fresh instance (reset singleton)
    TrustManager['instance'] = undefined;
    trustManager = TrustManager.getInstance();
  });

  afterEach(() => {
    trustManager.dispose();
    vi.clearAllMocks();
  });

  describe('getState()', () => {
    it('returns canExecute: true when workspace trusted AND scripts enabled', () => {
      mockWorkspace.isTrusted = true;
      mockConfigManager.get.mockImplementation((key: string) => {
        if (key === 'preview.enableScripts') return true;
        return undefined;
      });

      const state = trustManager.getState();

      expect(state.workspaceTrusted).toBe(true);
      expect(state.scriptsEnabled).toBe(true);
      expect(state.canExecute).toBe(true);
    });

    it('returns canExecute: false when workspace not trusted', () => {
      mockWorkspace.isTrusted = false;
      mockConfigManager.get.mockImplementation((key: string) => {
        if (key === 'preview.enableScripts') return true;
        return undefined;
      });

      const state = trustManager.getState();

      expect(state.workspaceTrusted).toBe(false);
      expect(state.scriptsEnabled).toBe(true);
      expect(state.canExecute).toBe(false);
    });

    it('returns canExecute: false when scripts disabled', () => {
      mockWorkspace.isTrusted = true;
      mockConfigManager.get.mockImplementation((key: string) => {
        if (key === 'preview.enableScripts') return false;
        return undefined;
      });

      const state = trustManager.getState();

      expect(state.workspaceTrusted).toBe(true);
      expect(state.scriptsEnabled).toBe(false);
      expect(state.canExecute).toBe(false);
    });

    it('returns canExecute: false when both conditions fail', () => {
      mockWorkspace.isTrusted = false;
      mockConfigManager.get.mockImplementation((key: string) => {
        if (key === 'preview.enableScripts') return false;
        return undefined;
      });

      const state = trustManager.getState();

      expect(state.workspaceTrusted).toBe(false);
      expect(state.scriptsEnabled).toBe(false);
      expect(state.canExecute).toBe(false);
    });
  });

  describe('getStateForDocument()', () => {
    it('returns canExecute: false for remote environment', () => {
      mockWorkspace.isTrusted = true;
      mockEnv.remoteName = 'ssh-remote';
      mockConfigManager.get.mockReturnValue(true);

      const docUri = {
        scheme: 'file',
        fsPath: '/workspace/test.mdx',
        path: '/workspace/test.mdx',
      };
      const state = trustManager.getStateForDocument(docUri as any);

      expect(state.canExecute).toBe(false);
      expect(state.reason).toContain('Remote environment detected');
    });

    it('returns canExecute: false for non-file scheme (vscode-remote)', () => {
      mockWorkspace.isTrusted = true;
      mockEnv.remoteName = undefined;
      mockConfigManager.get.mockReturnValue(true);

      const docUri = {
        scheme: 'vscode-remote',
        fsPath: '/workspace/test.mdx',
        path: '/workspace/test.mdx',
      };
      const state = trustManager.getStateForDocument(docUri as any);

      expect(state.canExecute).toBe(false);
      expect(state.reason).toContain('Unsupported document scheme');
    });

    it('returns canExecute: true for file: scheme in trusted workspace', () => {
      mockWorkspace.isTrusted = true;
      mockEnv.remoteName = undefined;
      mockConfigManager.get.mockReturnValue(true);

      const docUri = {
        scheme: 'file',
        fsPath: '/workspace/test.mdx',
        path: '/workspace/test.mdx',
      };
      const state = trustManager.getStateForDocument(docUri as any);

      expect(state.canExecute).toBe(true);
      expect(state.reason).toBeUndefined();
    });

    it('returns canExecute: true for untitled: scheme in trusted workspace', () => {
      mockWorkspace.isTrusted = true;
      mockEnv.remoteName = undefined;
      mockConfigManager.get.mockReturnValue(true);

      const docUri = {
        scheme: 'untitled',
        fsPath: 'Untitled-1',
        path: 'Untitled-1',
      };
      const state = trustManager.getStateForDocument(docUri as any);

      expect(state.canExecute).toBe(true);
    });

    it('includes reason when blocked', () => {
      mockWorkspace.isTrusted = false;

      const docUri = {
        scheme: 'file',
        fsPath: '/workspace/test.mdx',
        path: '/workspace/test.mdx',
      };
      const state = trustManager.getStateForDocument(docUri as any);

      expect(state.canExecute).toBe(false);
      expect(state.reason).toBeDefined();
      expect(state.reason).toContain('Workspace is not trusted');
    });
  });

  describe('getMode()', () => {
    it('returns SecurityMode.Trusted when canExecute is true', () => {
      mockWorkspace.isTrusted = true;
      mockConfigManager.get.mockReturnValue(true);

      const mode = trustManager.getMode();

      expect(mode).toBe(SecurityMode.Trusted);
    });

    it('returns SecurityMode.Safe when canExecute is false', () => {
      mockWorkspace.isTrusted = false;

      const mode = trustManager.getMode();

      expect(mode).toBe(SecurityMode.Safe);
    });
  });

  describe('canExecute()', () => {
    it('returns true when workspace trusted AND scripts enabled', () => {
      mockWorkspace.isTrusted = true;
      mockConfigManager.get.mockReturnValue(true);

      expect(trustManager.canExecute()).toBe(true);
    });

    it('returns false when workspace not trusted', () => {
      mockWorkspace.isTrusted = false;

      expect(trustManager.canExecute()).toBe(false);
    });
  });

  describe('canUseTrustedMode()', () => {
    it('returns allowed: false w/ reason for remote environment', () => {
      mockWorkspace.isTrusted = true;
      mockEnv.remoteName = 'ssh-remote';
      mockConfigManager.get.mockReturnValue(true);

      const docUri = {
        scheme: 'file',
        fsPath: '/workspace/test.mdx',
        path: '/workspace/test.mdx',
      };
      const result = trustManager.canUseTrustedMode(docUri as any);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Remote environment');
    });

    it('returns allowed: false w/ reason for unsupported scheme', () => {
      mockWorkspace.isTrusted = true;
      mockEnv.remoteName = undefined;
      mockConfigManager.get.mockReturnValue(true);

      const docUri = { scheme: 'http', fsPath: '/test.mdx', path: '/test.mdx' };
      const result = trustManager.canUseTrustedMode(docUri as any);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Unsupported document scheme');
    });

    it('returns allowed: true for valid local file', () => {
      mockWorkspace.isTrusted = true;
      mockEnv.remoteName = undefined;
      mockConfigManager.get.mockReturnValue(true);

      const docUri = {
        scheme: 'file',
        fsPath: '/workspace/test.mdx',
        path: '/workspace/test.mdx',
      };
      const result = trustManager.canUseTrustedMode(docUri as any);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('returns allowed: false when workspace not trusted', () => {
      mockWorkspace.isTrusted = false;

      const docUri = {
        scheme: 'file',
        fsPath: '/workspace/test.mdx',
        path: '/workspace/test.mdx',
      };
      const result = trustManager.canUseTrustedMode(docUri as any);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Workspace is not trusted');
    });

    it('returns allowed: false when scripts disabled', () => {
      mockWorkspace.isTrusted = true;
      mockConfigManager.get.mockImplementation((key: string) => {
        if (key === 'preview.enableScripts') return false;
        return undefined;
      });

      const docUri = {
        scheme: 'file',
        fsPath: '/workspace/test.mdx',
        path: '/workspace/test.mdx',
      };
      const result = trustManager.canUseTrustedMode(docUri as any);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Scripts are not enabled');
    });
  });

  describe('subscribe()', () => {
    it('returns a disposable subscription', () => {
      const listener = vi.fn();
      const subscription = trustManager.subscribe(listener);

      expect(subscription).toBeDefined();
      expect(typeof subscription.dispose).toBe('function');

      subscription.dispose();
    });
  });
});

describe('getSecurityMode()', () => {
  it('returns Trusted when canExecute is true', () => {
    const state: TrustState = {
      workspaceTrusted: true,
      scriptsEnabled: true,
      canExecute: true,
      openMdxLinksInPreview: true,
    };

    expect(getSecurityMode(state)).toBe(SecurityMode.Trusted);
  });

  it('returns Safe when canExecute is false', () => {
    const state: TrustState = {
      workspaceTrusted: false,
      scriptsEnabled: true,
      canExecute: false,
      openMdxLinksInPreview: true,
    };

    expect(getSecurityMode(state)).toBe(SecurityMode.Safe);
  });
});
