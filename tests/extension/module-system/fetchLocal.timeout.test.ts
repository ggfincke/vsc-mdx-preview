// tests/extension/module-system/fetchLocal.timeout.test.ts
// unit tests for fetchLocal timeout delegation

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ErrorContext } from '../../../packages/extension-host/src/shared/errors';

import {
  mockFrameworkDetector,
  mockErrorReporter,
} from '../../helpers/mock-services';

const {
  mockCheckFsPathAsync,
  mockReadFileAsync,
  mockHandleByExtension,
  mockResolver,
} = vi.hoisted(() => ({
  mockCheckFsPathAsync: vi.fn(),
  mockReadFileAsync: vi.fn(),
  mockHandleByExtension: vi.fn(),
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

vi.mock('../../../packages/extension-host/src/shared/utils/file-utils', () => ({
  readFileAsync: mockReadFileAsync,
}));

vi.mock(
  '../../../packages/extension-host/src/features/module-runtime/handlers',
  () => ({
    handleByExtension: mockHandleByExtension,
  })
);

vi.mock(
  '../../../packages/extension-host/src/features/module-runtime/resolution/UnifiedResolver',
  () => ({
    getUnifiedResolver: () => mockResolver,
  })
);

import { fetchLocal } from '../../../packages/extension-host/src/features/module-runtime/fetch/fetchLocal';

function createPreviewStub(tempDir: string) {
  const dependentFsPaths = new Set<string>();
  return {
    entryFsDirectory: tempDir,
    dependentFsPaths,
    dependencyGeneration: 1,
    commitModuleDependencySnapshot: vi.fn(
      (ownerFsPath, _dependencies, watchFiles) => {
        dependentFsPaths.add(ownerFsPath);
        for (const watchFile of watchFiles ?? []) {
          dependentFsPaths.add(watchFile);
        }
      }
    ),
    typescriptConfiguration: undefined,
    configuration: {
      updateMode: 'onSave',
    },
    doc: {
      uri: { fsPath: path.join(tempDir, 'entry.mdx') },
    },
    webviewHandle: {},
  };
}

describe('fetchLocal timeout delegation', () => {
  let tempDir: string;
  let modulePath: string;

  beforeEach(async () => {
    vi.clearAllMocks();

    tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'mdx-preview-fetch-local-')
    );
    modulePath = path.join(tempDir, 'module.js');
    await fs.promises.writeFile(modulePath, 'export const value = 1;', 'utf-8');

    mockCheckFsPathAsync.mockResolvedValue(true);
    mockResolver.resolveAsync.mockResolvedValue({
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

  it('reads module source once from disk & dispatches to the handler', async () => {
    const result = await fetchLocal(
      './module.js',
      false,
      path.join(tempDir, 'entry.mdx'),
      createPreviewStub(tempDir) as any
    );

    expect(result).toEqual({
      fsPath: modulePath,
      code: 'compiled',
      dependencies: [],
    });
    // buffered single-read pipeline: source text reaches the handler
    expect(mockHandleByExtension).toHaveBeenCalledWith(
      'export const value = 1;',
      expect.any(String),
      '.js',
      expect.anything()
    );
  });

  it('dispatches forward-slash fsPaths to the extension handler', async () => {
    mockReadFileAsync.mockResolvedValueOnce('export const value = 1;');

    await fetchLocal(
      './module.js',
      false,
      path.join(tempDir, 'entry.mdx'),
      createPreviewStub(tempDir) as any
    );

    // normalizePathSeparators keeps resolution paths backslash-free (xyc/vscode-mdx-preview#13)
    const handlerPath = mockHandleByExtension.mock.calls[0]?.[1];
    expect(handlerPath).not.toContain('\\');
  });

  it('reports errors when the module read fails', async () => {
    // read failure (deleted between resolve & read) surfaces via error reporter
    fs.rmSync(modulePath);

    const result = await fetchLocal(
      './module.js',
      false,
      path.join(tempDir, 'entry.mdx'),
      createPreviewStub(tempDir) as any
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
