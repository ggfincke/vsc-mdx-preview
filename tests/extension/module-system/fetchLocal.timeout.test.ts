// tests/extension/module-system/fetchLocal.timeout.test.ts
// unit tests for fetchLocal timeout delegation

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ErrorContext } from '../../../packages/extension/errors';
import { MODULE_FETCH_TIMEOUT_MS } from '../../../packages/extension/constants';

const {
  mockCheckFsPathAsync,
  mockReadFileAsync,
  mockHandleByExtension,
  mockResolver,
  mockFrameworkDetector,
  mockErrorReporter,
} = vi.hoisted(() => ({
  mockCheckFsPathAsync: vi.fn(),
  mockReadFileAsync: vi.fn(),
  mockHandleByExtension: vi.fn(),
  mockResolver: {
    resolveSync: vi.fn(),
  },
  mockFrameworkDetector: {
    getFramework: vi.fn(() => ({ framework: 'generic', detected: true })),
    areShimsEnabled: vi.fn(() => true),
  },
  mockErrorReporter: {
    report: vi.fn(),
  },
}));

vi.mock('../../../packages/extension/module-system/security/checkFsPath', () => ({
  checkFsPathAsync: mockCheckFsPathAsync,
}));

vi.mock('../../../packages/extension/utils/file-utils', () => ({
  readFileAsync: mockReadFileAsync,
}));

vi.mock('../../../packages/extension/module-system/handlers', () => ({
  handleByExtension: mockHandleByExtension,
}));

vi.mock(
  '../../../packages/extension/module-system/resolver/UnifiedResolver',
  () => ({
    getUnifiedResolver: () => mockResolver,
  })
);

vi.mock('../../../packages/extension/services', () => ({
  getFrameworkDetector: () => mockFrameworkDetector,
  getErrorReporter: () => mockErrorReporter,
}));

vi.mock('../../../packages/extension/logging', () => ({
  createTaggedLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { fetchLocal } from '../../../packages/extension/module-system/fetcher/fetchLocal';

describe('fetchLocal timeout delegation', () => {
  let tempDir: string;
  let modulePath: string;

  beforeEach(async () => {
    vi.clearAllMocks();

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdx-preview-fetch-local-'));
    modulePath = path.join(tempDir, 'module.js');
    await fs.promises.writeFile(modulePath, 'export const value = 1;', 'utf-8');

    mockCheckFsPathAsync.mockResolvedValue(true);
    mockResolver.resolveSync.mockReturnValue({
      fsPath: modulePath,
      isBuiltInShim: false,
    });
    mockHandleByExtension.mockResolvedValue({
      fsPath: modulePath,
      code: 'compiled',
      dependencies: [],
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('routes module file reads through readFileAsync w/ timeout metadata', async () => {
    mockReadFileAsync.mockResolvedValueOnce('export const value = 1;');

    const result = await fetchLocal(
      './module.js',
      false,
      path.join(tempDir, 'entry.mdx'),
      {
        entryFsDirectory: tempDir,
        dependentFsPaths: new Set<string>(),
        typescriptConfiguration: undefined,
        configuration: {
          updateMode: 'onSave',
        },
        doc: {
          uri: { fsPath: path.join(tempDir, 'entry.mdx') },
        },
        webviewHandle: {},
      } as any
    );

    expect(result).toEqual({
      fsPath: modulePath,
      code: 'compiled',
      dependencies: [],
    });
    expect(mockReadFileAsync).toHaveBeenCalledWith(modulePath, 'utf-8', {
      timeoutMs: MODULE_FETCH_TIMEOUT_MS,
      timeoutMessage: `Module fetch timed out after ${MODULE_FETCH_TIMEOUT_MS / 1000}s: module.js`,
      onError: expect.any(Function),
    });
  });

  it('reports errors when readFileAsync returns null after timeout', async () => {
    mockReadFileAsync.mockImplementationOnce(
      async (
        _filePath: string,
        _encoding: BufferEncoding,
        options?: { onError?: (error: unknown) => void }
      ) => {
        options?.onError?.(new Error('timed out'));
        return null;
      }
    );

    const result = await fetchLocal(
      './module.js',
      false,
      path.join(tempDir, 'entry.mdx'),
      {
        entryFsDirectory: tempDir,
        dependentFsPaths: new Set<string>(),
        typescriptConfiguration: undefined,
        configuration: {
          updateMode: 'onSave',
        },
        doc: {
          uri: { fsPath: path.join(tempDir, 'entry.mdx') },
        },
        webviewHandle: {},
      } as any
    );

    expect(result).toBeUndefined();
    expect(mockErrorReporter.report).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        context: ErrorContext.ModuleFetch,
        showInWebview: true,
      })
    );
  });
});
