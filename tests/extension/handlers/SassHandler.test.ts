// tests/extension/handlers/SassHandler.test.ts
// focused tests for SASS handler critical behavior

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Preview } from '../../../packages/extension-host/src/features/preview/preview-manager';

const { mockGet, mockClear } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockClear: vi.fn(),
}));

vi.mock('../../../packages/extension-host/src/shared/utils/lazy-import', () => ({
  createKeyedLazyImport: vi.fn(() => ({
    get: mockGet,
    clear: mockClear,
  })),
  loadModuleWithEsmFallback: vi.fn(),
}));

vi.mock('../../../packages/extension-host/src/shared/logging/logger', () => ({
  createTaggedLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

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

function createMockPreview(entryFsDirectory: string): Preview {
  return {
    entryFsDirectory,
  } as Preview;
}

describe('SassHandler', () => {
  const handler = new SassHandler();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReset();
    mockClear.mockReset();
  });

  it('handles .scss and .sass extensions', () => {
    expect(handler.extensions).toContain('.scss');
    expect(handler.extensions).toContain('.sass');
  });

  it('returns helper CSS when workspace root is unavailable', async () => {
    const result = await handler.handle(
      '',
      '/tmp/styles/main.scss',
      createMockPreview('')
    );

    expect(result.css).toContain('SCSS/Sass Support Not Available');
    expect(result.code).toBe('');
    expect(result.dependencies).toEqual([]);
  });

  it('returns helper CSS when sass is not installed', async () => {
    mockGet.mockResolvedValueOnce(null);

    const result = await handler.handle(
      '',
      '/workspace/styles/main.scss',
      createMockPreview('/workspace')
    );

    expect(mockGet).toHaveBeenCalledWith('/workspace');
    expect(result.css).toContain('SCSS/Sass Support Not Available');
    expect(result.css).toContain('main.scss');
  });

  it('compiles SCSS via workspace sass module', async () => {
    const compileAsync = vi.fn().mockResolvedValue({
      css: '.compiled{color:red;}',
    });
    mockGet.mockResolvedValueOnce({ compileAsync });

    const fsPath = '/workspace/styles/main.scss';
    const result = await handler.handle('', fsPath, createMockPreview('/workspace'));

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
    mockGet.mockResolvedValueOnce({ compileAsync });

    const result = await handler.handle(
      '',
      '/workspace/styles/main.scss',
      createMockPreview('/workspace')
    );

    expect(result.css).toContain('SCSS Compilation Error');
    expect(result.css).toContain('Undefined variable');
    expect(result.css).toContain('main.scss');
    expect(result.code).toBe('');
  });

  it('clears cached sass instances', () => {
    clearSassCache();
    expect(mockClear).toHaveBeenCalledTimes(1);
  });
});
