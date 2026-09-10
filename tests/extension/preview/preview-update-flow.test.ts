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
import { DocumentTracker } from '../../../packages/extension-host/src/features/preview/watchers/DocumentTracker';

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
      getDirtyGeneration: () => 0,
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
      getDirtyGeneration: () => 0,
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
      getDirtyGeneration: () => 0,
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

  it('marks rendered only after a successful current evaluation', async () => {
    const evaluate = vi.fn(async () => {
      throw new Error('boom');
    });
    const docTracker = new DocumentTracker();
    const markRendered = vi.spyOn(docTracker, 'markRendered');
    const input = {
      doc: createDoc(),
      text: '# current',
      entryFsDirectory: '/workspace',
      updateMode: 'onType' as const,
      getDocumentTracker: () => docTracker,
    };

    await expect(
      runPreviewUpdateFlow({
        ...input,
        evaluate,
      })
    ).rejects.toThrow('boom');

    expect(markRendered).not.toHaveBeenCalled();

    docTracker.markStale();
    let finish!: () => void;
    const pending = runPreviewUpdateFlow({
      ...input,
      evaluate: () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    });
    docTracker.markStale();
    finish();
    await pending;
    expect(markRendered).not.toHaveBeenCalled();
    expect(docTracker.isStale()).toBe(true);

    await runPreviewUpdateFlow({
      ...input,
      isCurrent: () => false,
      evaluate: async () => {},
    });
    expect(markRendered).not.toHaveBeenCalled();

    await runPreviewUpdateFlow({ ...input, evaluate: async () => {} });
    expect(docTracker.isStale()).toBe(false);
    expect(docTracker.hasRenderedVersion(input.doc.uri.toString(), 7)).toBe(
      true
    );
  });
});
