// tests/extension/rpc-input-validation.test.ts
// verify representative RPC validation boundaries

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockErrorReporter, mockTrustManager } from '../helpers/mock-services';

const {
  mockHandlePreviewSourceLineReport,
  mockSuppressEditorScrollSync,
  mockVscode,
} = vi.hoisted(() => ({
  mockHandlePreviewSourceLineReport: vi.fn(() => 'accepted'),
  mockSuppressEditorScrollSync: vi.fn(),
  mockVscode: {
    Uri: {
      file: (path: string) => ({ scheme: 'file', fsPath: path, path }),
      parse: (uri: string) => ({ scheme: 'file', fsPath: uri, path: uri }),
    },
    workspace: {
      openTextDocument: vi.fn(),
      isTrusted: true,
      workspaceFolders: [{ uri: { fsPath: '/workspace' } }],
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
  '../../packages/extension-host/src/features/preview/scroll-sync',
  () => ({
    handlePreviewSourceLineReport: mockHandlePreviewSourceLineReport,
    suppressEditorScrollSync: mockSuppressEditorScrollSync,
  })
);

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

function createMockPreview(fsPath = '/workspace/test.mdx', active = true) {
  return {
    doc: {
      uri: { scheme: 'file', fsPath },
      getText: () => '# Test',
    },
    fsPath,
    entryFsDirectory: '/workspace',
    active,
    configuration: { scrollSync: 'bidirectional' },
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
    mockHandlePreviewSourceLineReport.mockReturnValue('accepted');
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

  it('rejects malicious path-like RPC inputs (null bytes, traversal)', async () => {
    const result = await handle.fetch('react\0.malicious', false, '/entry.mdx');

    expect(result).toBeUndefined();

    mockErrorReporter.report.mockClear();
    mockVscode.workspace.openTextDocument.mockClear();

    await handle.openDocument('../outside.mdx');
    await handle.openPreview('../outside.mdx');

    expect(mockVscode.workspace.openTextDocument).not.toHaveBeenCalled();
    expect(mockErrorReporter.report).toHaveBeenCalledTimes(2);
  });

  it('gates openDocument on workspace trust', async () => {
    // nested entry dir so secure-path root resolution succeeds (entry != folder)
    const docPreview = {
      ...createMockPreview('/workspace/docs/test.mdx'),
      entryFsDirectory: '/workspace/docs',
    } as ReturnType<typeof createMockPreview>;
    const docHandle = new ExtensionHandle(docPreview);

    mockTrustManager.getState.mockReturnValue({
      workspaceTrusted: false,
      scriptsEnabled: false,
      canExecute: false,
      openMdxLinksInPreview: true,
    });

    await docHandle.openDocument('test.mdx');

    expect(mockVscode.workspace.openTextDocument).not.toHaveBeenCalled();
    expect(mockVscode.window.showTextDocument).not.toHaveBeenCalled();

    mockTrustManager.getState.mockReturnValue({
      workspaceTrusted: true,
      scriptsEnabled: true,
      canExecute: true,
      openMdxLinksInPreview: true,
    });

    await docHandle.openDocument('test.mdx');

    expect(mockVscode.workspace.openTextDocument).toHaveBeenCalledTimes(1);
    expect(mockVscode.window.showTextDocument).toHaveBeenCalledTimes(1);

    // workspace-only gate: trusted workspace w/ scripts off (Safe Mode) still opens
    // guards against silent escalation to the full canExecute gate
    mockVscode.workspace.openTextDocument.mockClear();
    mockVscode.window.showTextDocument.mockClear();
    mockTrustManager.getState.mockReturnValue({
      workspaceTrusted: true,
      scriptsEnabled: false,
      canExecute: false,
      openMdxLinksInPreview: true,
    });

    await docHandle.openDocument('test.mdx');

    expect(mockVscode.workspace.openTextDocument).toHaveBeenCalledTimes(1);
    expect(mockVscode.window.showTextDocument).toHaveBeenCalledTimes(1);
  });

  it('calls completeHandshake during handshake', () => {
    handle.handshake(7);

    expect(preview.completeHandshake).toHaveBeenCalledWith(7);
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

  it('handles safe commands and rejects unsafe external URLs', () => {
    handle.openExternal('javascript:alert(1)');

    expect(mockVscode.env.openExternal).not.toHaveBeenCalled();
    handle.openSettings('mdx-preview.preview.enableScripts');

    expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith(
      'workbench.action.openSettings',
      'mdx-preview.preview.enableScripts'
    );
  });

  it('validates and suppresses source-line editor opens', async () => {
    for (const line of [0, 1.5, Number.NaN]) {
      await expect(handle.reportPreviewSourceLine(line)).resolves.toBe(
        'ignored'
      );
    }
    expect(mockHandlePreviewSourceLineReport).not.toHaveBeenCalled();

    await expect(handle.reportPreviewSourceLine(8)).resolves.toBe('accepted');
    expect(mockHandlePreviewSourceLineReport).toHaveBeenCalledWith(preview, 8);
    mockHandlePreviewSourceLineReport.mockClear();

    for (const line of [0, 1.5, Number.NaN]) {
      await handle.openSourceLine(line);
    }

    expect(mockVscode.window.showTextDocument).not.toHaveBeenCalled();
    expect(mockSuppressEditorScrollSync).not.toHaveBeenCalled();

    handle = new ExtensionHandle(
      createMockPreview('/workspace/test.mdx', false)
    );
    await handle.openSourceLine(12);

    expect(mockVscode.window.showTextDocument).not.toHaveBeenCalled();
    expect(mockSuppressEditorScrollSync).not.toHaveBeenCalled();

    preview = createMockPreview();
    handle = new ExtensionHandle(preview);
    let resolveShow: ((value: unknown) => void) | undefined;
    mockVscode.window.showTextDocument.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveShow = resolve;
        })
    );

    const openPromise = handle.openSourceLine(12);

    expect(mockSuppressEditorScrollSync).toHaveBeenCalledTimes(1);
    const [shownDocument, showOptions] =
      mockVscode.window.showTextDocument.mock.calls[0];
    expect(shownDocument).toBe(preview.doc);
    expect(showOptions.preserveFocus).toBe(false);
    expect(showOptions.selection.start.line).toBe(11);
    expect(showOptions.selection.start.character).toBe(0);
    expect(
      mockSuppressEditorScrollSync.mock.invocationCallOrder[0]
    ).toBeLessThan(
      mockVscode.window.showTextDocument.mock.invocationCallOrder[0]
    );

    resolveShow?.({});
    await openPromise;

    expect(mockSuppressEditorScrollSync).toHaveBeenCalledTimes(2);
    expect(
      mockVscode.window.showTextDocument.mock.invocationCallOrder[0]
    ).toBeLessThan(mockSuppressEditorScrollSync.mock.invocationCallOrder[1]);

    mockSuppressEditorScrollSync.mockClear();
    mockVscode.window.showTextDocument.mockClear();
    mockVscode.window.showTextDocument.mockRejectedValueOnce(new Error('nope'));

    await handle.openSourceLine(4);

    expect(mockVscode.window.showTextDocument).toHaveBeenCalledTimes(1);
    expect(mockSuppressEditorScrollSync).toHaveBeenCalledTimes(2);
  });
});
