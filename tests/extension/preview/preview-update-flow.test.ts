// tests/extension/preview/preview-update-flow.test.ts
// unit tests for preview update flow routing

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockReadFileAsync, mockWorkspaceReadFile } = vi.hoisted(() => ({
  mockReadFileAsync: vi.fn(),
  mockWorkspaceReadFile: vi.fn(),
}));

vi.mock('vscode', () => ({
  workspace: {
    fs: {
      readFile: (...args: unknown[]) => mockWorkspaceReadFile(...args),
    },
  },
}));

vi.mock('../../../packages/extension-host/src/shared/utils/file-utils', () => ({
  readFileAsync: (...args: unknown[]) => mockReadFileAsync(...args),
}));

import { runPreviewUpdateFlow } from '../../../packages/extension-host/src/features/preview/preview-update-flow';

function createDoc(overrides: Partial<any> = {}) {
  return {
    uri: {
      scheme: 'file',
      fsPath: '/workspace/doc.mdx',
    },
    version: 7,
    ...overrides,
  };
}

describe('runPreviewUpdateFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadFileAsync.mockResolvedValue('# saved');
    mockWorkspaceReadFile.mockResolvedValue(
      new TextEncoder().encode('# remote')
    );
  });

  it('skips evaluation when rendered version already exists and force is false', async () => {
    const evaluate = vi.fn(async () => {});
    const docTracker = {
      hasRenderedVersion: vi.fn(() => true),
      markRendered: vi.fn(),
    };

    await runPreviewUpdateFlow({
      force: false,
      doc: createDoc(),
      text: '# current',
      entryFsDirectory: '/workspace',
      updateMode: 'onType',
      getDocumentTracker: () => docTracker,
      evaluate,
    });

    expect(evaluate).not.toHaveBeenCalled();
    expect(docTracker.markRendered).not.toHaveBeenCalled();
  });

  it('routes file + onType to in-memory text', async () => {
    const evaluate = vi.fn(async () => {});
    const docTracker = {
      hasRenderedVersion: vi.fn(() => false),
      markRendered: vi.fn(),
    };

    await runPreviewUpdateFlow({
      force: false,
      doc: createDoc(),
      text: '# in-memory',
      entryFsDirectory: '/workspace',
      updateMode: 'onType',
      getDocumentTracker: () => docTracker,
      evaluate,
    });

    expect(evaluate).toHaveBeenCalledWith('# in-memory', '/workspace/doc.mdx');
    expect(docTracker.markRendered).toHaveBeenCalledWith(7);
  });

  it('routes file + onSave/manual to disk read text', async () => {
    const evaluate = vi.fn(async () => {});
    const docTracker = {
      hasRenderedVersion: vi.fn(() => false),
      markRendered: vi.fn(),
    };

    await runPreviewUpdateFlow({
      force: false,
      doc: createDoc(),
      text: '# in-memory',
      entryFsDirectory: '/workspace',
      updateMode: 'onSave',
      getDocumentTracker: () => docTracker,
      evaluate,
    });

    expect(mockReadFileAsync).toHaveBeenCalledWith(
      '/workspace/doc.mdx',
      'utf8',
      expect.any(Object)
    );
    expect(evaluate).toHaveBeenCalledWith('# saved', '/workspace/doc.mdx');
  });

  it('marks rendered only after successful evaluation', async () => {
    const evaluate = vi.fn(async () => {
      throw new Error('boom');
    });
    const docTracker = {
      hasRenderedVersion: vi.fn(() => false),
      markRendered: vi.fn(),
    };

    await expect(
      runPreviewUpdateFlow({
        force: false,
        doc: createDoc(),
        text: '# current',
        entryFsDirectory: '/workspace',
        updateMode: 'onType',
        getDocumentTracker: () => docTracker,
        evaluate,
      })
    ).rejects.toThrow('boom');

    expect(docTracker.markRendered).not.toHaveBeenCalled();
  });
});
