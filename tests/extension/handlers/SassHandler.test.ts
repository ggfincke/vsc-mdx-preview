// tests/extension/handlers/SassHandler.test.ts
// focused tests for SASS handler critical behavior

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ModuleExecutionContext } from '../../../packages/extension-host/src/features/module-runtime/types/handlers';

const { mockLoadModuleWithEsmFallback } = vi.hoisted(() => ({
  mockLoadModuleWithEsmFallback: vi.fn(),
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
      resolveSync: vi.fn(() => undefined),
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

  it('compiles SCSS via workspace sass module', async () => {
    const compileAsync = vi.fn().mockResolvedValue({
      css: '.compiled{color:red;}',
    });
    mockLoadModuleWithEsmFallback.mockResolvedValueOnce({ compileAsync });

    const fsPath = '/workspace/styles/main.scss';
    const result = await handler.handle(
      '',
      fsPath,
      createContext('/workspace')
    );

    expect(compileAsync).toHaveBeenCalledTimes(1);
    expect(compileAsync).toHaveBeenCalledWith(
      fsPath,
      expect.objectContaining({
        importers: expect.any(Array),
      })
    );
    expect(result.css).toBe('.compiled{color:red;}');
    expect(result.code).toBe('');
    expect(result.dependencies).toEqual([]);
  });

  it('returns CSS error comment when sass compilation fails', async () => {
    const compileAsync = vi
      .fn()
      .mockRejectedValueOnce(new Error('Undefined variable'));
    mockLoadModuleWithEsmFallback.mockResolvedValueOnce({ compileAsync });

    const result = await handler.handle(
      '',
      '/workspace/styles/main.scss',
      createContext('/workspace')
    );

    expect(result.css).toContain('SCSS Compilation Error');
    expect(result.css).toContain('Undefined variable');
    expect(result.css).toContain('main.scss');
    expect(result.code).toBe('');
  });

  it('fences stale Sass loads after clear & keyed loads after clearKey', async () => {
    const oldLoad = createDeferred<{
      compileAsync: ReturnType<typeof vi.fn>;
    }>();
    const freshLoad = createDeferred<{
      compileAsync: ReturnType<typeof vi.fn>;
    }>();
    const oldCompile = vi.fn().mockResolvedValue({ css: '.old{}' });
    const freshCompile = vi.fn().mockResolvedValue({ css: '.fresh{}' });
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

    freshLoad.resolve({ compileAsync: freshCompile });
    await expect(freshResult).resolves.toMatchObject({ css: '.fresh{}' });
    oldLoad.resolve({ compileAsync: oldCompile });
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
