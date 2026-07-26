// tests/extension/fetch/fetch-local.test.ts
// verify image, binary, builtin, & single-read behavior through fetchLocal

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Preview } from '../../../packages/extension-host/src/features/preview/preview-manager';
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
    configuration: { updateMode: 'onSave' },
    doc: { uri: { fsPath: path.join(tempDir, 'entry.mdx') } },
    getWebviewUri: (fsPath: string) => `webview:${fsPath}`,
    webviewHandle: {},
  } as Preview;
}

describe('fetchLocal', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'mdx-preview-fetch-local-')
    );
    mockCheckFsPathAsync.mockResolvedValue(true);
    mockResolver.resolveAsync.mockImplementation(
      async (request: string) => ({
        fsPath: path.join(tempDir, request.replace(/^\.\//, '')),
        isBuiltInShim: false,
        specifier: request,
      })
    );
    mockFrameworkDetector.getFramework.mockReturnValue({
      framework: 'generic',
      confidence: 1,
    });
    mockFrameworkDetector.areShimsEnabled.mockReturnValue(true);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('dispatches binary image fixtures to ImageHandler without reading them', async () => {
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
  });

  it('still rejects a non-image binary after its single read', async () => {
    const binaryPath = path.join(tempDir, 'archive.bin');
    fs.writeFileSync(binaryPath, Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    const readSpy = vi.spyOn(fs.promises, 'readFile');

    await expect(
      fetchLocal(
        './archive.bin',
        false,
        path.join(tempDir, 'entry.mdx'),
        createPreview(tempDir)
      )
    ).resolves.toBeUndefined();
    expect(readSpy).toHaveBeenCalledTimes(1);
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

  it('performs one stat & one read for a cold source fetch', async () => {
    fs.writeFileSync(path.join(tempDir, 'data.json'), '{"answer":42}');
    const statSpy = vi.spyOn(fs.promises, 'stat');
    const readSpy = vi.spyOn(fs.promises, 'readFile');

    const result = await fetchLocal(
      './data.json',
      false,
      path.join(tempDir, 'entry.mdx'),
      createPreview(tempDir)
    );

    expect(result?.code).toBe('module.exports = {"answer":42}');
    expect(statSpy).toHaveBeenCalledTimes(1);
    expect(readSpy).toHaveBeenCalledTimes(1);
  });
});
