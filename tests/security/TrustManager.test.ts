// tests/security/TrustManager.test.ts
// verify representative workspace trust boundaries

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  mockConfigManager,
  mockPreviewManager,
} from '../helpers/mock-services';
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

import { TrustManager } from '../../packages/extension-host/src/features/security/TrustManager';

describe('TrustManager', () => {
  let trustManager: TrustManager;
  let configurationChange: ((affectedKeys: string[]) => void) | undefined;

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
    mockConfigManager.onDidChangeConfiguration.mockImplementation(
      (callback) => {
        configurationChange = callback;
        return { dispose: vi.fn() };
      }
    );
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

  it('pushes one link-policy update without recompiling content', async () => {
    const setTrustState = vi.fn();
    const updateWebview = vi.fn();
    mockPreviewManager.getCurrentPreview.mockReturnValue({
      active: true,
      doc: {
        uri: {
          scheme: 'file',
          fsPath: '/workspace/test.mdx',
          path: '/workspace/test.mdx',
        },
      },
      webviewHandle: { setTrustState },
      updateWebview,
    });

    configurationChange?.([SETTINGS.OPEN_MDX_LINKS_IN_PREVIEW]);
    await Promise.resolve();

    expect(setTrustState).toHaveBeenCalledTimes(1);
    expect(setTrustState).toHaveBeenCalledWith(
      expect.objectContaining({ openMdxLinksInPreview: true })
    );
    expect(updateWebview).not.toHaveBeenCalled();
  });
});
