// tests/extension/handlers/SassHandler.test.ts
// focused tests for SASS handler critical behavior

import * as path from 'path';
import { pathToFileURL } from 'url';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ModuleExecutionContext } from '../../../packages/extension-host/src/features/module-runtime/types/handlers';

const { mockLoadModuleWithEsmFallback, mockResolveSync } = vi.hoisted(() => ({
  mockLoadModuleWithEsmFallback: vi.fn(),
  mockResolveSync: vi.fn(() => undefined as string | undefined),
}));

vi.mock(
  '../../../packages/extension-host/src/shared/utils/lazy-import',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('../../../packages/extension-host/src/shared/utils/lazy-import')
      >();
    return {
      ...actual,
      loadModuleWithEsmFallback: mockLoadModuleWithEsmFallback,
    };
  }
);

vi.mock(
  '../../../packages/extension-host/src/features/module-runtime/resolution/resolver-factory',
  () => ({
    getBrowserResolver: () => ({
      resolveSync: mockResolveSync,
    }),
  })
);

import {
  SassHandler,
  clearSassCache,
} from '../../../packages/extension-host/src/features/module-runtime/handlers/SassHandler';
import { createKeyedLazyImport } from '../../../packages/extension-host/src/shared/utils/lazy-import';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function createContext(entryFsDirectory: string): ModuleExecutionContext {
  return {
    entryFsDirectory,
    documentUri: {} as ModuleExecutionContext['documentUri'],
    useSucraseTranspiler: false,
    getWebviewUri: () => undefined,
  };
}

describe('SassHandler', () => {
  const handler = new SassHandler();

  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadModuleWithEsmFallback.mockReset();
    clearSassCache();
  });

  it('handles Sass extensions & explains a missing workspace root', async () => {
    expect(handler.extensions).toContain('.scss');
    expect(handler.extensions).toContain('.sass');

    const result = await handler.handle(
      '',
      '/tmp/styles/main.scss',
      createContext('')
    );

    expect(result.css).toContain('SCSS/Sass Support Not Available');
    expect(result.code).toBe('');
    expect(result.dependencies).toEqual([]);
  });

  it('compiles live SCSS & indented Sass w/ watch-only loaded URLs', async () => {
    const fsPath = '/workspace/styles/main.scss';
    const partialPath = '/workspace/styles/_theme.scss';
    const nestedPath = '/workspace/styles/tokens/_colors.scss';
    const sassPath = '/workspace/styles/main.sass';
    const scssSource = '$tone: blue; .live { color: $tone; }';
    const sassSource = '$tone: blue\n.live\n  color: $tone';
    const compileStringAsync = vi
      .fn()
      .mockResolvedValueOnce({
        css: '.live{color:blue;}',
        loadedUrls: [
          pathToFileURL(fsPath),
          pathToFileURL(partialPath),
          pathToFileURL(nestedPath),
          pathToFileURL(partialPath),
          new URL('https://example.com/theme.scss'),
        ],
      })
      .mockResolvedValueOnce({
        css: '.live{color:blue;}',
        loadedUrls: [pathToFileURL(sassPath)],
      });
    mockLoadModuleWithEsmFallback.mockResolvedValueOnce({
      compileStringAsync,
    });

    const result = await handler.handle(
      scssSource,
      fsPath,
      createContext('/workspace')
    );

    expect(compileStringAsync).toHaveBeenNthCalledWith(
      1,
      scssSource,
      expect.objectContaining({
        url: pathToFileURL(fsPath),
        syntax: 'scss',
        importers: expect.any(Array),
      })
    );
    expect(result.css).toBe('.live{color:blue;}');
    expect(result.code).toBe('');
    expect(result.dependencies).toEqual([]);
    expect(result.watchFiles).toEqual([
      path.normalize(partialPath),
      path.normalize(nestedPath),
    ]);

    const options = compileStringAsync.mock.calls[0][1] as {
      importers: Array<{ findFileUrl: (url: string) => URL | null }>;
    };
    const resolvedImportPath = '/workspace/shared/_tokens.scss';
    mockResolveSync.mockReturnValueOnce(resolvedImportPath);
    expect(options.importers[0].findFileUrl('@shared/tokens')).toEqual(
      pathToFileURL(resolvedImportPath)
    );
    expect(mockResolveSync).toHaveBeenCalledWith(
      {},
      path.dirname(fsPath),
      '@shared/tokens'
    );

    const sassResult = await handler.handle(
      sassSource,
      sassPath,
      createContext('/workspace')
    );
    expect(compileStringAsync).toHaveBeenNthCalledWith(
      2,
      sassSource,
      expect.objectContaining({
        url: pathToFileURL(sassPath),
        syntax: 'indented',
      })
    );
    expect(sassResult.watchFiles).toEqual([]);
  });

  it('returns CSS error comment when sass compilation fails', async () => {
    const compileStringAsync = vi
      .fn()
      .mockRejectedValueOnce(new Error('Undefined variable'));
    mockLoadModuleWithEsmFallback.mockResolvedValueOnce({
      compileStringAsync,
    });

    const result = await handler.handle(
      '',
      '/workspace/styles/main.scss',
      createContext('/workspace')
    );

    expect(result.css).toContain('SCSS Compilation Error');
    expect(result.css).toContain('Undefined variable');
    expect(result.css).toContain('main.scss');
    expect(result.code).toBe('');
    expect(result).not.toHaveProperty('watchFiles');
  });

  it('fences stale Sass loads after clear & keyed loads after clearKey', async () => {
    const oldLoad = createDeferred<{
      compileStringAsync: ReturnType<typeof vi.fn>;
    }>();
    const freshLoad = createDeferred<{
      compileStringAsync: ReturnType<typeof vi.fn>;
    }>();
    const oldCompile = vi.fn().mockResolvedValue({
      css: '.old{}',
      loadedUrls: [],
    });
    const freshCompile = vi.fn().mockResolvedValue({
      css: '.fresh{}',
      loadedUrls: [],
    });
    mockLoadModuleWithEsmFallback
      .mockReturnValueOnce(oldLoad.promise)
      .mockReturnValueOnce(freshLoad.promise);
    const context = createContext('/workspace');
    const fsPath = '/workspace/styles/main.scss';

    const oldResult = handler.handle('', fsPath, context);
    await vi.waitFor(() =>
      expect(mockLoadModuleWithEsmFallback).toHaveBeenCalledTimes(1)
    );
    clearSassCache();
    const freshResult = handler.handle('', fsPath, context);
    await vi.waitFor(() =>
      expect(mockLoadModuleWithEsmFallback).toHaveBeenCalledTimes(2)
    );

    freshLoad.resolve({ compileStringAsync: freshCompile });
    await expect(freshResult).resolves.toMatchObject({ css: '.fresh{}' });
    oldLoad.resolve({ compileStringAsync: oldCompile });
    await expect(oldResult).resolves.toMatchObject({ css: '.old{}' });
    await expect(handler.handle('', fsPath, context)).resolves.toMatchObject({
      css: '.fresh{}',
    });

    expect(mockLoadModuleWithEsmFallback).toHaveBeenCalledTimes(2);
    expect(freshCompile).toHaveBeenCalledTimes(2);

    const oldKeyLoad = createDeferred<string | null>();
    const freshKeyLoad = createDeferred<string | null>();
    const loadFn = vi
      .fn()
      .mockReturnValueOnce(oldKeyLoad.promise)
      .mockReturnValueOnce(freshKeyLoad.promise);
    const loader = createKeyedLazyImport({ loadFn });
    const oldKeyResult = loader.get('/workspace');
    await vi.waitFor(() => expect(loadFn).toHaveBeenCalledTimes(1));
    loader.clearKey('/workspace');
    const freshKeyResult = loader.get('/workspace');
    await vi.waitFor(() => expect(loadFn).toHaveBeenCalledTimes(2));

    freshKeyLoad.resolve('fresh-key');
    await expect(freshKeyResult).resolves.toBe('fresh-key');
    oldKeyLoad.resolve('old-key');
    await expect(oldKeyResult).resolves.toBe('old-key');
    await expect(loader.get('/workspace')).resolves.toBe('fresh-key');
    expect(loadFn).toHaveBeenCalledTimes(2);
  });
});
