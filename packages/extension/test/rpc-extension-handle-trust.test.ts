// packages/extension/test/rpc-extension-handle-trust.test.ts
// tests for ExtensionHandle.fetch trust gating behavior

import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import {
  __setMockTrusted,
  __setMockConfig,
  __setMockRemoteName,
  __setMockWorkspaceFolders,
  __resetMocks,
  __getMockConfig,
  createMockTextDocument,
} from './__mocks__/vscode';
import { handleDidChangeWorkspaceFolders } from '../security/checkFsPath';
import ExtensionHandle from '../rpc-extension-handle';
import { TrustManager } from '../security/TrustManager';
import { ServiceRegistry } from '../services/ServiceRegistry';
import { ServiceNames } from '../services/service-names';
import type { Preview } from '../preview/preview-manager';
import { fetchLocal } from '../module-fetcher/module-fetcher';

// mock getConfigManager and getTrustManager
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
    getTrustManager: () => TrustManager.getInstance(),
  };
});

// mock the module fetcher to avoid actual file system access
vi.mock('../module-fetcher/module-fetcher', () => ({
  fetchLocal: vi.fn(),
}));

// mock logging to capture warnings - use vi.hoisted() for proper hoisting
const { mockLogWarn, mockLogError, mockLogDebug } = vi.hoisted(() => ({
  mockLogWarn: vi.fn(),
  mockLogError: vi.fn(),
  mockLogDebug: vi.fn(),
}));
vi.mock('../logging', () => ({
  error: mockLogError,
  warn: mockLogWarn,
  debug: mockLogDebug,
}));

// reset TrustManager singleton between tests
const resetTrustManager = (): void => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (TrustManager as any).instance = undefined;
};

// create a mock Preview object for testing
function createMockPreview(uri: {
  scheme: string;
  fsPath: string;
  path?: string;
}): Preview {
  const mockDoc = createMockTextDocument({
    getText: () => '# Test MDX',
  });
  // Override the uri property to match what we need
  Object.defineProperty(mockDoc, 'uri', {
    get: () => ({
      scheme: uri.scheme,
      fsPath: uri.fsPath,
      path: uri.path || uri.fsPath,
    }),
  });

  return {
    doc: mockDoc,
    active: true,
    // Use workspace-relative path for entry directory
    entryFsDirectory: '/workspace/src',
    fsPath: uri.fsPath,
    webviewHandshakePromise: Promise.resolve(),
  } as unknown as Preview;
}

describe('ExtensionHandle.fetch trust gating', () => {
  beforeEach(() => {
    __resetMocks();
    resetTrustManager();
    ServiceRegistry.reset();
    vi.clearAllMocks();

    // set up workspace folders for path validation
    __setMockWorkspaceFolders([{ uri: { fsPath: '/workspace' } }]);
    handleDidChangeWorkspaceFolders();

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

  test('blocks fetch for remote documents', async () => {
    __setMockTrusted(true);
    __setMockConfig('preview.enableScripts', true);
    __setMockRemoteName('ssh-remote');

    const preview = createMockPreview({
      scheme: 'file',
      fsPath: '/remote/test.mdx',
    });
    const handle = new ExtensionHandle(preview);

    const result = await handle.fetch(
      './component.tsx',
      false,
      '/remote/test.mdx'
    );

    expect(result).toBeUndefined();
    expect(mockLogWarn).toHaveBeenCalledWith(
      expect.stringContaining('fetch: blocked')
    );
  });

  test('blocks fetch for non-file scheme documents', async () => {
    __setMockTrusted(true);
    __setMockConfig('preview.enableScripts', true);
    __setMockRemoteName(undefined);

    const preview = createMockPreview({
      scheme: 'vscode-remote',
      fsPath: '/test.mdx',
    });
    const handle = new ExtensionHandle(preview);

    const result = await handle.fetch('./component.tsx', false, '/test.mdx');

    expect(result).toBeUndefined();
    expect(mockLogWarn).toHaveBeenCalledWith(
      expect.stringContaining('fetch: blocked')
    );
  });

  test('blocks fetch when workspace not trusted', async () => {
    __setMockTrusted(false);
    __setMockConfig('preview.enableScripts', true);
    __setMockRemoteName(undefined);

    const preview = createMockPreview({
      scheme: 'file',
      fsPath: '/local/test.mdx',
    });
    const handle = new ExtensionHandle(preview);

    const result = await handle.fetch(
      './component.tsx',
      false,
      '/local/test.mdx'
    );

    expect(result).toBeUndefined();
    expect(mockLogWarn).toHaveBeenCalledWith(
      expect.stringContaining('fetch: blocked')
    );
  });

  test('blocks fetch when scripts disabled', async () => {
    __setMockTrusted(true);
    __setMockConfig('preview.enableScripts', false);
    __setMockRemoteName(undefined);

    const preview = createMockPreview({
      scheme: 'file',
      fsPath: '/local/test.mdx',
    });
    const handle = new ExtensionHandle(preview);

    const result = await handle.fetch(
      './component.tsx',
      false,
      '/local/test.mdx'
    );

    expect(result).toBeUndefined();
    expect(mockLogWarn).toHaveBeenCalledWith(
      expect.stringContaining('fetch: blocked')
    );
  });

  test('allows fetch for local file: documents when trusted', async () => {
    __setMockTrusted(true);
    __setMockConfig('preview.enableScripts', true);
    __setMockRemoteName(undefined);

    // Set up fetchLocal mock to return a valid result
    vi.mocked(fetchLocal).mockResolvedValueOnce({
      code: 'export default {}',
      dependencies: [],
      fsPath: '/workspace/src/component.tsx',
    });

    const preview = createMockPreview({
      scheme: 'file',
      fsPath: '/workspace/src/test.mdx',
    });
    const handle = new ExtensionHandle(preview);

    const result = await handle.fetch(
      './component.tsx',
      false,
      '/workspace/src/test.mdx'
    );

    // Should not be undefined (fetch was allowed)
    expect(result).toBeDefined();
    // fetchLocal should have been called
    expect(fetchLocal).toHaveBeenCalled();
    // Should not have logged a warning about blocking
    expect(mockLogWarn).not.toHaveBeenCalledWith(
      expect.stringContaining('fetch: blocked')
    );
  });

  test('allows fetch for untitled: documents when trusted', async () => {
    __setMockTrusted(true);
    __setMockConfig('preview.enableScripts', true);
    __setMockRemoteName(undefined);

    // Set up fetchLocal mock to return a valid result
    vi.mocked(fetchLocal).mockResolvedValueOnce({
      code: 'export default {}',
      dependencies: [],
      fsPath: '/workspace/src/component.tsx',
    });

    const preview = createMockPreview({
      scheme: 'untitled',
      fsPath: 'Untitled-1',
    });
    const handle = new ExtensionHandle(preview);

    const result = await handle.fetch(
      './component.tsx',
      false,
      '/workspace/src/test.mdx'
    );

    // Should not be undefined (fetch was allowed)
    expect(result).toBeDefined();
    // fetchLocal should have been called
    expect(fetchLocal).toHaveBeenCalled();
    // Should not have logged a warning about blocking
    expect(mockLogWarn).not.toHaveBeenCalledWith(
      expect.stringContaining('fetch: blocked')
    );
  });

  test('logs appropriate warning with rejection reason', async () => {
    __setMockTrusted(true);
    __setMockConfig('preview.enableScripts', true);
    __setMockRemoteName('wsl');

    const preview = createMockPreview({
      scheme: 'file',
      fsPath: '/test.mdx',
    });
    const handle = new ExtensionHandle(preview);

    await handle.fetch('./component.tsx', false, '/test.mdx');

    // Should include the reason from TrustManager
    expect(mockLogWarn).toHaveBeenCalledWith(
      expect.stringMatching(/fetch: blocked.*Remote/i)
    );
  });

  test('handles all trust failure scenarios with appropriate messages', async () => {
    // Test workspace not trusted
    __setMockTrusted(false);
    __setMockConfig('preview.enableScripts', false);
    __setMockRemoteName(undefined);

    const preview = createMockPreview({
      scheme: 'file',
      fsPath: '/test.mdx',
    });
    const handle = new ExtensionHandle(preview);

    await handle.fetch('./component.tsx', false, '/test.mdx');

    expect(mockLogWarn).toHaveBeenCalledWith(
      expect.stringContaining('fetch: blocked')
    );
  });
});
