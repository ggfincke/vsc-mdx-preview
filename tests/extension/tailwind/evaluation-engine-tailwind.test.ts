// tests/extension/tailwind/evaluation-engine-tailwind.test.ts
// processTailwindAsync disabled-fallthrough watch-file clearing

import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  mockTailwindProcessor,
  mockErrorReporter,
} from '../../helpers/mock-services';

const {
  mockRaceTimeout,
  mockTransformEntry,
  mockExtractImportSpecifiers,
} = vi.hoisted(() => ({
  mockRaceTimeout: vi.fn(),
  mockTransformEntry: vi.fn(),
  mockExtractImportSpecifiers: vi.fn(),
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

function createParams() {
  return {
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
      enabled: 'enabled' as const,
      maxFileSizeBytes: 1024,
      maxCssFilesToSearch: 50,
      cacheMaxEntries: 10,
      cacheTtlSeconds: 60,
      compilationTimeout: 1234,
    },
  };
}

describe('EvaluationEngine Tailwind disabled fallthrough', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTailwindProcessor.process.mockResolvedValue({
      profile: 'disabled',
      enabled: false,
      css: '',
      watchFiles: [],
    });
  });

  it('clears stale watch-files when profile is disabled', async () => {
    // disabled: not browser, not (advanced && enabled); stale watchFiles present
    mockRaceTimeout.mockResolvedValueOnce({
      profile: 'disabled',
      enabled: false,
      css: '',
      watchFiles: ['stale/file.css'],
    });

    const engine = new EvaluationEngine();
    const preview = createPreview();
    const webviewHandle = {
      setTailwindCss: vi.fn(),
      setTailwindBrowserCss: vi.fn(),
    };

    await engine.processTailwindAsync(
      preview as any,
      createParams(),
      7,
      webviewHandle as any
    );

    // last call clears the stale watch-files in the fallthrough branch
    expect(preview.updateTailwindWatchFiles).toHaveBeenLastCalledWith([]);
    expect(webviewHandle.setTailwindBrowserCss).toHaveBeenCalledWith('');
    expect(webviewHandle.setTailwindCss).toHaveBeenCalledWith('');
    expect(mockErrorReporter.report).not.toHaveBeenCalled();
  });

  it('does not clear watch-files when profile is advanced & enabled', async () => {
    mockRaceTimeout.mockResolvedValueOnce({
      profile: 'advanced',
      enabled: true,
      css: '.a{}',
      watchFiles: ['live/file.css'],
    });

    const engine = new EvaluationEngine();
    const preview = createPreview();
    const webviewHandle = {
      setTailwindCss: vi.fn(),
      setTailwindBrowserCss: vi.fn(),
    };

    await engine.processTailwindAsync(
      preview as any,
      createParams(),
      8,
      webviewHandle as any
    );

    // advanced path keeps live watch-files; never falls through to the clear
    expect(preview.updateTailwindWatchFiles).toHaveBeenCalledTimes(1);
    expect(preview.updateTailwindWatchFiles).toHaveBeenCalledWith([
      'live/file.css',
    ]);
    expect(webviewHandle.setTailwindCss).toHaveBeenCalledWith('.a{}');
  });
});
