// tests/extension/tailwind/TailwindCompiler.test.ts
// unit tests for TailwindCompiler module loading flow

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TailwindError } from '../../../packages/extension-host/src/shared/errors';

const { mockLoadModuleWithEsmFallback } = vi.hoisted(() => ({
  mockLoadModuleWithEsmFallback: vi.fn(),
}));

vi.mock('../../../packages/extension-host/src/shared/utils/lazy-import', () => ({
  loadModuleWithEsmFallback: mockLoadModuleWithEsmFallback,
}));

vi.mock('../../../packages/extension-host/src/shared/logging/logger', () => ({
  createTaggedLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import {
  TailwindCompiler,
  clearPostCSSCache,
} from '../../../packages/extension-host/src/features/tailwind/TailwindCompiler';

describe('TailwindCompiler', () => {
  beforeEach(() => {
    clearPostCSSCache();
    vi.clearAllMocks();
  });

  it('loads postcss once & reuses it across compile calls', async () => {
    const process = vi.fn().mockResolvedValue({ css: 'compiled-css' });
    const postcss = vi.fn(() => ({ process }));
    const tailwindPluginFactory = vi.fn(() => ({
      postcssPlugin: 'tailwind-plugin',
    }));

    mockLoadModuleWithEsmFallback.mockImplementation(
      async (moduleId: string) => {
        if (moduleId === 'postcss') {
          return postcss;
        }
        if (moduleId === '@tailwindcss/postcss') {
          return tailwindPluginFactory;
        }
        throw new Error(`Unexpected module id: ${moduleId}`);
      }
    );

    const compiler = new TailwindCompiler();
    await compiler.compile({
      tailwindVersion: 'v4',
      content: 'text-red-500',
    });
    await compiler.compile({
      tailwindVersion: 'v4',
      content: 'text-blue-500',
    });

    expect(
      mockLoadModuleWithEsmFallback.mock.calls.filter(
        ([moduleId]: [string]) => moduleId === 'postcss'
      )
    ).toHaveLength(1);
    expect(
      mockLoadModuleWithEsmFallback.mock.calls.filter(
        ([moduleId]: [string]) => moduleId === '@tailwindcss/postcss'
      )
    ).toHaveLength(2);
    expect(process).toHaveBeenCalledTimes(2);
  });

  it('reloads postcss after clearPostCSSCache', async () => {
    const process = vi.fn().mockResolvedValue({ css: 'compiled-css' });
    const postcss = vi.fn(() => ({ process }));
    const tailwindPluginFactory = vi.fn(() => ({
      postcssPlugin: 'tailwind-plugin',
    }));

    mockLoadModuleWithEsmFallback.mockImplementation(
      async (moduleId: string) => {
        if (moduleId === 'postcss') {
          return postcss;
        }
        if (moduleId === '@tailwindcss/postcss') {
          return tailwindPluginFactory;
        }
        throw new Error(`Unexpected module id: ${moduleId}`);
      }
    );

    const compiler = new TailwindCompiler();
    await compiler.compile({
      tailwindVersion: 'v4',
      content: 'text-red-500',
    });

    clearPostCSSCache();

    await compiler.compile({
      tailwindVersion: 'v4',
      content: 'text-blue-500',
    });

    expect(
      mockLoadModuleWithEsmFallback.mock.calls.filter(
        ([moduleId]: [string]) => moduleId === 'postcss'
      )
    ).toHaveLength(2);
  });

  it('throws TailwindError when plugin module export is not a function', async () => {
    mockLoadModuleWithEsmFallback.mockImplementation(async () => ({}));

    const compiler = new TailwindCompiler();
    const compilePromise = compiler.compile({
      tailwindVersion: 'v4',
      content: 'text-red-500',
    });

    await expect(compilePromise).rejects.toBeInstanceOf(TailwindError);
    await expect(compilePromise).rejects.toMatchObject({
      code: 'E562',
    });
  });
});
