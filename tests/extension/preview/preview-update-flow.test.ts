// tests/extension/preview/preview-update-flow.test.ts
// unit tests for preview update flow routing

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockReadFileRequiredAsync, mockWorkspaceReadFile } = vi.hoisted(() => ({
  mockReadFileRequiredAsync: vi.fn(),
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
  readFileRequiredAsync: (...args: unknown[]) =>
    mockReadFileRequiredAsync(...args),
}));

import { runPreviewUpdateFlow } from '../../../packages/extension-host/src/features/preview/preview-update-flow';

function createDoc(overrides: Partial<any> = {}) {
  return {
    uri: {
      scheme: 'file',
      fsPath: '/workspace/doc.mdx',
      toString: () => 'file:///workspace/doc.mdx',
    },
    version: 7,
    ...overrides,
  };
}

describe('runPreviewUpdateFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadFileRequiredAsync.mockResolvedValue('# saved');
    mockWorkspaceReadFile.mockResolvedValue(
      new TextEncoder().encode('# remote')
    );
  });

  it('skips an already rendered document but renders a same-version document switch', async () => {
    const evaluate = vi.fn(async () => {});
    const docTracker = {
      hasRenderedVersion: vi.fn(
        (documentUri: string) => documentUri === 'file:///workspace/doc.mdx'
      ),
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

    await runPreviewUpdateFlow({
      force: false,
      doc: createDoc({
        uri: {
          scheme: 'file',
          fsPath: '/workspace/second.mdx',
          toString: () => 'file:///workspace/second.mdx',
        },
      }),
      text: '# second',
      entryFsDirectory: '/workspace',
      updateMode: 'onType',
      getDocumentTracker: () => docTracker,
      evaluate,
    });

    expect(evaluate).toHaveBeenCalledWith('# second', '/workspace/second.mdx');
    expect(docTracker.markRendered).toHaveBeenCalledWith(
      'file:///workspace/second.mdx',
      7
    );
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
    expect(docTracker.markRendered).toHaveBeenCalledWith(
      'file:///workspace/doc.mdx',
      7
    );
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

    expect(mockReadFileRequiredAsync).toHaveBeenCalledWith(
      '/workspace/doc.mdx',
      'utf8'
    );
    expect(evaluate).toHaveBeenCalledWith('# saved', '/workspace/doc.mdx');

    const readError = new Error('disk unavailable');
    mockReadFileRequiredAsync.mockRejectedValueOnce(readError);

    await expect(
      runPreviewUpdateFlow({
        doc: createDoc(),
        text: '# in-memory',
        entryFsDirectory: '/workspace',
        updateMode: 'onSave',
        getDocumentTracker: () => undefined,
        evaluate: vi.fn(),
      })
    ).rejects.toBe(readError);
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
