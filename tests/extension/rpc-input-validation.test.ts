// tests/extension/rpc-input-validation.test.ts
// verify representative RPC validation boundaries

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockTrustManager } from '../helpers/mock-services';

const { mockVscode } = vi.hoisted(() => ({
  mockVscode: {
    Uri: {
      file: (path: string) => ({ scheme: 'file', fsPath: path, path }),
      parse: (uri: string) => ({ scheme: 'file', fsPath: uri, path: uri }),
    },
    workspace: {
      openTextDocument: vi.fn(),
      isTrusted: true,
    },
    window: {
      showTextDocument: vi.fn(),
    },
    env: {
      openExternal: vi.fn(),
    },
    commands: {
      executeCommand: vi.fn(),
    },
    Position: class {
      constructor(
        public line: number,
        public character: number
      ) {}
    },
    Range: class {
      constructor(
        public start: { line: number; character: number },
        public end: { line: number; character: number }
      ) {}
    },
  },
}));

vi.mock('vscode', () => mockVscode);

vi.mock('perf_hooks', () => ({
  performance: {
    mark: vi.fn(),
    measure: vi.fn(),
  },
}));

vi.mock(
  '../../packages/extension-host/src/features/module-runtime/fetch/fetchLocal',
  () => ({
    fetchLocal: vi
      .fn()
      .mockResolvedValue({ code: '', dependencies: [], fsPath: '' }),
  })
);

import ExtensionHandle from '../../packages/extension-host/src/platform/rpc/extension-rpc-handler';
import { MAX_FETCH_REQUEST_LENGTH } from '../../packages/extension-host/src/shared/constants';

function createMockPreview(fsPath = '/workspace/test.mdx') {
  return {
    doc: {
      uri: { scheme: 'file', fsPath },
      getText: () => '# Test',
    },
    fsPath,
    entryFsDirectory: '/workspace',
    completeHandshake: vi.fn(),
    evaluationDuration: 0,
  } as unknown as Parameters<typeof ExtensionHandle>[0];
}

describe('RPC Input Validation', () => {
  let handle: ExtensionHandle;
  let preview: ReturnType<typeof createMockPreview>;

  beforeEach(() => {
    vi.clearAllMocks();
    preview = createMockPreview();
    handle = new ExtensionHandle(preview);
    mockVscode.workspace.openTextDocument.mockResolvedValue({});
    mockVscode.window.showTextDocument.mockResolvedValue({});
    mockTrustManager.getState.mockReturnValue({
      workspaceTrusted: true,
      scriptsEnabled: true,
      canExecute: true,
      openMdxLinksInPreview: true,
    });
    mockTrustManager.getStateForDocument.mockReturnValue({
      workspaceTrusted: true,
      scriptsEnabled: true,
      canExecute: true,
      openMdxLinksInPreview: true,
    });
  });

  it('records valid numeric performance durations', () => {
    handle.reportPerformance(150);

    expect(preview.evaluationDuration).toBe(150);
  });

  it('rejects null byte injection attempts in fetch specifiers', async () => {
    const result = await handle.fetch('react\0.malicious', false, '/entry.mdx');

    expect(result).toBeUndefined();
  });

  it('calls completeHandshake during handshake', () => {
    handle.handshake();

    expect(preview.completeHandshake).toHaveBeenCalled();
  });

  it('rejects fetch requests when trusted execution is unavailable', async () => {
    mockTrustManager.getStateForDocument.mockReturnValue({
      workspaceTrusted: false,
      scriptsEnabled: true,
      canExecute: false,
      openMdxLinksInPreview: true,
    });

    const result = await handle.fetch('./module.ts', false, '/entry.mdx');

    expect(result).toBeUndefined();
  });

  it('rejects javascript URLs in openExternal', () => {
    handle.openExternal('javascript:alert(1)');

    expect(mockVscode.env.openExternal).not.toHaveBeenCalled();
  });

  it('opens settings for explicit setting ids', () => {
    handle.openSettings('mdx-preview.preview.enableScripts');

    expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith(
      'workbench.action.openSettings',
      'mdx-preview.preview.enableScripts'
    );
  });
});
