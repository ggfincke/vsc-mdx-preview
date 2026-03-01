// tests/security/TrustManager.test.ts
// verify representative workspace trust boundaries

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockConfigManager } from '../helpers/mock-services';
import { SETTINGS } from '../../packages/extension-host/src/shared/config/ConfigManager';

const { mockWorkspace, mockEnv } = vi.hoisted(() => ({
  mockWorkspace: {
    isTrusted: true,
    onDidChangeWorkspaceTrust: vi.fn(() => ({ dispose: vi.fn() })),
    onDidGrantWorkspaceTrust: vi.fn(() => ({ dispose: vi.fn() })),
    onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
  },
  mockEnv: {
    remoteName: undefined as string | undefined,
  },
}));

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

import {
  getSecurityMode,
  SecurityMode,
  TrustManager,
} from '../../packages/extension-host/src/features/security/TrustManager';
import type { TrustState } from '@mdx-preview/contracts';

describe('TrustManager', () => {
  let trustManager: TrustManager;

  beforeEach(() => {
    mockWorkspace.isTrusted = true;
    mockEnv.remoteName = undefined;
    mockConfigManager.get.mockImplementation((key: string) => {
      if (key === SETTINGS.ENABLE_SCRIPTS) {
        return true;
      }
      if (key === SETTINGS.OPEN_MDX_LINKS_IN_PREVIEW) {
        return true;
      }
      return undefined;
    });
    TrustManager['instance'] = undefined;
    trustManager = TrustManager.getInstance();
  });

  afterEach(() => {
    trustManager.dispose();
    vi.clearAllMocks();
  });

  it('allows execution when the workspace is trusted and scripts are enabled', () => {
    const state = trustManager.getState();

    expect(state.workspaceTrusted).toBe(true);
    expect(state.scriptsEnabled).toBe(true);
    expect(state.canExecute).toBe(true);
  });

  it('blocks execution when the workspace is not trusted', () => {
    mockWorkspace.isTrusted = false;

    expect(trustManager.getState().canExecute).toBe(false);
  });

  it('blocks trusted mode for remote documents', () => {
    mockEnv.remoteName = 'ssh-remote';

    const state = trustManager.getStateForDocument({
      scheme: 'file',
      fsPath: '/workspace/test.mdx',
      path: '/workspace/test.mdx',
    } as never);

    expect(state.canExecute).toBe(false);
    expect(state.reason).toContain('Remote environment detected');
  });

  it('returns a reason when document trust checks fail', () => {
    mockWorkspace.isTrusted = false;

    const state = trustManager.getStateForDocument({
      scheme: 'file',
      fsPath: '/workspace/test.mdx',
      path: '/workspace/test.mdx',
    } as never);

    expect(state.canExecute).toBe(false);
    expect(state.reason).toContain('Workspace is not trusted');
  });

  it('rejects unsupported document schemes for trusted mode', () => {
    const result = trustManager.canUseTrustedMode({
      scheme: 'http',
      fsPath: '/test.mdx',
      path: '/test.mdx',
    } as never);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Unsupported document scheme');
  });

  it('maps blocked trust states to safe mode', () => {
    const state: TrustState = {
      workspaceTrusted: false,
      scriptsEnabled: true,
      canExecute: false,
      openMdxLinksInPreview: true,
    };

    expect(getSecurityMode(state)).toBe(SecurityMode.Safe);
  });
});
