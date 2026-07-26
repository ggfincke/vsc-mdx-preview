// tests/extension/fetch/fetch-local.test.ts
// verify image, binary, builtin, & single-read behavior through fetchLocal

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Preview } from '../../../packages/extension-host/src/features/preview/preview-manager';
import { MAX_MODULE_FILE_SIZE_BYTES } from '../../../packages/extension-host/src/shared/constants';
import {
  mockErrorReporter,
  mockFrameworkDetector,
} from '../../helpers/mock-services';

const { mockCheckFsPathAsync, mockResolver } = vi.hoisted(() => ({
  mockCheckFsPathAsync: vi.fn(),
  mockResolver: {
    resolveAsync: vi.fn(),
  },
}));

vi.mock(
  '../../../packages/extension-host/src/features/module-runtime/security/checkFsPath',
  () => ({
    checkFsPathAsync: mockCheckFsPathAsync,
  })
);

vi.mock(
  '../../../packages/extension-host/src/features/module-runtime/resolution/UnifiedResolver',
  () => ({
    getUnifiedResolver: () => mockResolver,
  })
);

import { fetchLocal } from '../../../packages/extension-host/src/features/module-runtime/fetch/fetchLocal';
import {
  isCoreModule,
  NOOP_MODULE,
} from '../../../packages/extension-host/src/features/module-runtime/fetch/utils';

function createPreview(tempDir: string): Preview {
  return {
    entryFsDirectory: tempDir,
    dependentFsPaths: new Set<string>(),
    typescriptConfiguration: undefined,
    configuration: {
      updateMode: 'onSave',
      useSucraseTranspiler: false,
    },
    doc: { uri: { fsPath: path.join(tempDir, 'entry.mdx') } },
    getWebviewUri: (fsPath: string) => `webview:${fsPath}`,
    webviewHandle: {},
  } as Preview;
}

describe('fetchLocal', () => {
  let tempDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'mdx-preview-fetch-local-')
    );
    vscode.workspace.textDocuments.length = 0;
    mockCheckFsPathAsync.mockResolvedValue(true);
    mockResolver.resolveAsync.mockImplementation(async (request: string) => ({
      fsPath: path.join(tempDir, request.replace(/^\.\//, '')),
      isBuiltInShim: false,
      specifier: request,
    }));
    mockFrameworkDetector.getFramework.mockReturnValue({
      framework: 'generic',
      confidence: 1,
    });
    mockFrameworkDetector.areShimsEnabled.mockReturnValue(true);
  });

  afterEach(() => {
    vscode.workspace.textDocuments.length = 0;
    vi.restoreAllMocks();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('routes images without source reads & rejects other binary files', async () => {
    const fixtures = [
      ['image.png', [0x89, 0x50, 0x4e, 0x47]],
      ['image.jpg', [0xff, 0xd8, 0xff]],
      ['image.gif', [0x47, 0x49, 0x46]],
      ['image.webp', [0x52, 0x49, 0x46, 0x46]],
    ] as const;
    for (const [fileName, signature] of fixtures) {
      fs.writeFileSync(path.join(tempDir, fileName), Buffer.from(signature));
    }
    const readSpy = vi.spyOn(fs.promises, 'readFile');
    const preview = createPreview(tempDir);

    for (const [fileName] of fixtures) {
      const fsPath = path.join(tempDir, fileName);
      const result = await fetchLocal(
        `./${fileName}`,
        false,
        path.join(tempDir, 'entry.mdx'),
        preview
      );
      expect(result).toMatchObject({
        fsPath,
        code: `module.exports = "webview:${fsPath}"`,
        dependencies: [],
      });
    }
    expect(readSpy).not.toHaveBeenCalled();
    expect(mockResolver.resolveAsync).toHaveBeenNthCalledWith(
      1,
      './image.png',
      {
        baseDir: tempDir,
        tsConfig: undefined,
        framework: 'generic',
        workspaceRoot: tempDir,
        shimsEnabled: true,
      },
      'browser'
    );

    const binaryPath = path.join(tempDir, 'archive.bin');
    fs.writeFileSync(binaryPath, Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    const openSpy = vi.spyOn(fs.promises, 'open');

    await expect(
      fetchLocal(
        './archive.bin',
        false,
        path.join(tempDir, 'entry.mdx'),
        createPreview(tempDir)
      )
    ).resolves.toBeUndefined();
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(mockErrorReporter.report).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Cannot import binary file'),
      }),
      expect.any(Object)
    );
  });

  it('returns noop stubs for builtin subpaths without prefix false positives', async () => {
    const preview = createPreview(tempDir);

    await expect(
      fetchLocal(
        'node:fs/promises',
        true,
        path.join(tempDir, 'entry.mdx'),
        preview
      )
    ).resolves.toMatchObject({
      fsPath: '/externalModules/fs/promises',
      code: NOOP_MODULE,
      dependencies: [],
    });
    expect(isCoreModule('assert/strict')).toBe(true);
    expect(isCoreModule('stream/promises')).toBe(true);
    expect(isCoreModule('fs-extra')).toBe(false);
    expect(mockResolver.resolveAsync).not.toHaveBeenCalled();
  });

  it('opens once, stats, reads the bounded source, & closes', async () => {
    fs.writeFileSync(path.join(tempDir, 'data.json'), '{"answer":42}');
    const source = Buffer.from('{"answer":42}');
    const stat = vi.fn().mockResolvedValue({ size: source.length });
    const read = vi
      .fn()
      .mockImplementation(async (buffer: Buffer, offset: number) => {
        source.copy(buffer, offset);
        return { bytesRead: source.length, buffer };
      });
    const close = vi.fn().mockResolvedValue(undefined);
    const openSpy = vi.spyOn(fs.promises, 'open').mockResolvedValue({
      stat,
      read,
      close,
    } as never);

    const result = await fetchLocal(
      './data.json',
      false,
      path.join(tempDir, 'entry.mdx'),
      createPreview(tempDir)
    );

    expect(result?.code).toBe('module.exports = {"answer":42}');
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(stat).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
    openSpy.mockRestore();

    const failingStat = vi.fn().mockResolvedValue({ size: 13 });
    const readError = new Error('read failed');
    const failingRead = vi.fn().mockRejectedValue(readError);
    const closeAfterError = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(fs.promises, 'open').mockResolvedValue({
      stat: failingStat,
      read: failingRead,
      close: closeAfterError,
    } as never);

    await expect(
      fetchLocal(
        './data.json',
        false,
        path.join(tempDir, 'entry.mdx'),
        createPreview(tempDir)
      )
    ).resolves.toBeUndefined();

    expect(closeAfterError).toHaveBeenCalledTimes(1);
    expect(mockErrorReporter.report).toHaveBeenCalledWith(
      readError,
      expect.any(Object)
    );
  });

  it('uses all normalized open dependencies & enforces their UTF-8 limit', async () => {
    const firstPath = path.join(tempDir, 'first.json');
    const secondPath = path.join(tempDir, 'second.json');
    fs.writeFileSync(firstPath, '{"source":"disk-first"}');
    fs.writeFileSync(secondPath, '{"source":"disk-second"}');
    vscode.workspace.textDocuments.push(
      {
        uri: vscode.Uri.file(path.join(tempDir, 'nested', '..', 'first.json')),
        getText: () => '{"source":"memory-first"}',
      },
      {
        uri: vscode.Uri.file(secondPath),
        getText: () => '{"source":"memory-second"}',
      }
    );
    const preview = createPreview(tempDir);
    preview.configuration.updateMode = 'onType';
    const openSpy = vi.spyOn(fs.promises, 'open');

    const [first, second] = await Promise.all([
      fetchLocal(
        './first.json',
        false,
        path.join(tempDir, 'entry.mdx'),
        preview
      ),
      fetchLocal(
        './second.json',
        false,
        path.join(tempDir, 'entry.mdx'),
        preview
      ),
    ]);

    expect(first?.code).toBe('module.exports = {"source":"memory-first"}');
    expect(second?.code).toBe('module.exports = {"source":"memory-second"}');
    expect(openSpy).not.toHaveBeenCalled();

    const modulePath = path.join(tempDir, 'oversized.json');
    fs.writeFileSync(modulePath, '{}');
    const oversizedText = `"${'é'.repeat(
      Math.floor(MAX_MODULE_FILE_SIZE_BYTES / 2) + 1
    )}"`;
    vscode.workspace.textDocuments.push({
      uri: vscode.Uri.file(modulePath),
      getText: () => oversizedText,
    });
    const oversizedPreview = createPreview(tempDir);
    oversizedPreview.configuration.updateMode = 'onType';

    await expect(
      fetchLocal(
        './oversized.json',
        false,
        path.join(tempDir, 'entry.mdx'),
        oversizedPreview
      )
    ).resolves.toBeUndefined();

    expect(mockErrorReporter.report).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('exceeds 5MB limit'),
      }),
      expect.any(Object)
    );
  });
});
