// tests/extension/preview/EvaluationEngine.timeout.test.ts
// unit tests for EvaluationEngine timeout behavior

import * as fs from 'fs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ErrorContext } from '../../../packages/extension-host/src/shared/errors';
import { MDX_COMPILATION_TIMEOUT_MS } from '../../../packages/extension-host/src/shared/constants';
import { DEFAULT_TAILWIND_COMPILATION_TIMEOUT_MS } from '@mdx-preview/contracts';

const {
  mockRaceTimeout,
  mockTransformEntry,
  mockExtractImportSpecifiers,
  mockTailwindProcessor,
  mockErrorReporter,
} = vi.hoisted(() => ({
  mockRaceTimeout: vi.fn(),
  mockTransformEntry: vi.fn(),
  mockExtractImportSpecifiers: vi.fn(),
  mockTailwindProcessor: {
    process: vi.fn(),
  },
  mockErrorReporter: {
    report: vi.fn(),
  },
}));

vi.mock(
  '../../../packages/extension-host/src/shared/utils/async-utils',
  () => ({
    raceTimeout: mockRaceTimeout,
  })
);

vi.mock(
  '../../../packages/extension-host/src/features/module-runtime/transform/transform',
  () => ({
    transformEntry: mockTransformEntry,
  })
);

vi.mock(
  '../../../packages/extension-host/src/features/module-runtime/dependencies/import-extractor',
  () => ({
    extractImportSpecifiers: mockExtractImportSpecifiers,
  })
);

vi.mock('../../../packages/extension-host/src/app/services', () => ({
  getTailwindProcessor: () => mockTailwindProcessor,
  getErrorReporter: () => mockErrorReporter,
}));

vi.mock('../../../packages/extension-host/src/shared/logging/logger', () => ({
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  createTaggedLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { EvaluationEngine } from '../../../packages/extension-host/src/features/preview/EvaluationEngine';

function createPreview() {
  return {
    doc: {
      uri: { fsPath: '/workspace/doc.mdx' },
    },
    isTailwindRequestCurrent: vi.fn(() => true),
    updateTailwindWatchFiles: vi.fn(),
  };
}

describe('EvaluationEngine timeout behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransformEntry.mockResolvedValue({
      code: 'compiled',
      esmCode: 'import x from "x"',
      frontmatter: undefined,
    });
    mockExtractImportSpecifiers.mockResolvedValue(['x']);
    mockTailwindProcessor.process.mockResolvedValue({
      profile: 'advanced',
      enabled: true,
      css: '',
      watchFiles: [],
    });
  });

  it('throws timeout error when trusted compilation times out', async () => {
    mockRaceTimeout.mockResolvedValueOnce(null);

    const engine = new EvaluationEngine();

    await expect(
      engine.evaluateTrusted(
        '# Test',
        '/workspace/doc.mdx',
        {} as any,
        {} as any
      )
    ).rejects.toThrow(
      `MDX compilation timed out after ${MDX_COMPILATION_TIMEOUT_MS / 1000}s`
    );

    expect(mockRaceTimeout).toHaveBeenCalledWith(expect.any(Promise), {
      timeoutMs: MDX_COMPILATION_TIMEOUT_MS,
      behavior: 'return-null',
    });
  });

  it('returns trusted evaluation result when raceTimeout resolves', async () => {
    const resolvedTransformResult = {
      code: 'compiled',
      esmCode: 'import React from "react"',
      frontmatter: { title: 'Doc' },
    };
    mockRaceTimeout.mockResolvedValueOnce(resolvedTransformResult);
    mockExtractImportSpecifiers.mockResolvedValueOnce(['react']);
    const realpathSpy = vi
      .spyOn(fs.promises, 'realpath')
      .mockResolvedValue('/workspace/resolved/doc.mdx' as any);

    const engine = new EvaluationEngine();
    const result = await engine.evaluateTrusted(
      '# Test',
      '/workspace/doc.mdx',
      {} as any,
      {} as any
    );

    expect(result).toEqual({
      code: 'compiled',
      entryFilePath: '/workspace/resolved/doc.mdx',
      dependencies: ['react'],
      frontmatter: { title: 'Doc' },
    });
    expect(mockExtractImportSpecifiers).toHaveBeenCalledWith(
      'import React from "react"'
    );

    realpathSpy.mockRestore();
  });

  it('reports timeout error when Tailwind compilation times out', async () => {
    mockRaceTimeout.mockResolvedValueOnce(null);

    const engine = new EvaluationEngine();
    const preview = createPreview();
    const webviewHandle = {
      setTailwindCss: vi.fn(),
      setTailwindBrowserCss: vi.fn(),
    };

    await engine.processTailwindAsync(
      preview as any,
      {
        mdxText: '# Tailwind',
        entryFilePath: '/workspace/doc.mdx',
        entryFileDependencies: [],
        trustState: {
          workspaceTrusted: true,
          scriptsEnabled: true,
          canExecute: true,
          openMdxLinksInPreview: true,
        },
        tailwindConfig: {
          enabled: 'enabled',
          maxFileSizeBytes: 1024,
          maxCssFilesToSearch: 50,
          cacheMaxEntries: 10,
          cacheTtlSeconds: 60,
          compilationTimeout: 1234,
        },
      },
      1,
      webviewHandle as any
    );

    expect(mockRaceTimeout).toHaveBeenCalledWith(expect.any(Promise), {
      timeoutMs: 1234,
      behavior: 'return-null',
    });
    expect(mockErrorReporter.report).toHaveBeenCalledTimes(1);
    expect(mockErrorReporter.report).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        context: ErrorContext.Tailwind,
        showNotification: true,
      })
    );
    expect(webviewHandle.setTailwindCss).not.toHaveBeenCalled();
    expect(webviewHandle.setTailwindBrowserCss).not.toHaveBeenCalled();
  });

  it('uses default Tailwind timeout when config value is missing', async () => {
    mockRaceTimeout.mockResolvedValueOnce({
      profile: 'advanced',
      enabled: true,
      css: '.x{}',
      watchFiles: ['tailwind.config.js'],
    });

    const engine = new EvaluationEngine();
    const preview = createPreview();
    const webviewHandle = {
      setTailwindCss: vi.fn(),
      setTailwindBrowserCss: vi.fn(),
    };

    await engine.processTailwindAsync(
      preview as any,
      {
        mdxText: '# Tailwind',
        entryFilePath: '/workspace/doc.mdx',
        entryFileDependencies: [],
        trustState: {
          workspaceTrusted: true,
          scriptsEnabled: true,
          canExecute: true,
          openMdxLinksInPreview: true,
        },
        tailwindConfig: {
          enabled: 'enabled',
          maxFileSizeBytes: 1024,
          maxCssFilesToSearch: 50,
          cacheMaxEntries: 10,
          cacheTtlSeconds: 60,
          compilationTimeout: undefined as unknown as number,
        },
      },
      99,
      webviewHandle as any
    );

    expect(mockRaceTimeout).toHaveBeenCalledWith(expect.any(Promise), {
      timeoutMs: DEFAULT_TAILWIND_COMPILATION_TIMEOUT_MS,
      behavior: 'return-null',
    });
    expect(preview.updateTailwindWatchFiles).toHaveBeenCalledWith([
      'tailwind.config.js',
    ]);
    expect(webviewHandle.setTailwindBrowserCss).toHaveBeenCalledWith('');
    expect(webviewHandle.setTailwindCss).toHaveBeenCalledWith('.x{}');
  });

  it('routes CSS to browser-tailwind handler when profile is browser', async () => {
    mockRaceTimeout.mockResolvedValueOnce({
      profile: 'browser',
      enabled: true,
      css: '@import "tailwindcss";',
      watchFiles: ['tailwind.css'],
    });

    const engine = new EvaluationEngine();
    const preview = createPreview();
    const webviewHandle = {
      setTailwindCss: vi.fn(),
      setTailwindBrowserCss: vi.fn(),
    };

    await engine.processTailwindAsync(
      preview as any,
      {
        mdxText: '# Tailwind',
        entryFilePath: '/workspace/doc.mdx',
        entryFileDependencies: [],
        trustState: {
          workspaceTrusted: true,
          scriptsEnabled: true,
          canExecute: true,
          openMdxLinksInPreview: true,
        },
        tailwindConfig: {
          enabled: 'enabled',
          maxFileSizeBytes: 1024,
          maxCssFilesToSearch: 50,
          cacheMaxEntries: 10,
          cacheTtlSeconds: 60,
          compilationTimeout: 1234,
        },
      },
      3,
      webviewHandle as any
    );

    expect(preview.updateTailwindWatchFiles).toHaveBeenCalledWith([
      'tailwind.css',
    ]);
    expect(webviewHandle.setTailwindCss).toHaveBeenCalledWith('');
    expect(webviewHandle.setTailwindBrowserCss).toHaveBeenCalledWith(
      '@import "tailwindcss";'
    );
  });
});
