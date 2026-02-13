// tests/extension/tailwind/TailwindProcessor.test.ts
// unit tests for Tailwind processing pipeline

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TailwindProcessor } from '../../../packages/extension-host/src/features/tailwind/TailwindProcessor';
import type { TailwindConfig } from '../../../packages/extension-host/src/shared/config/EffectivePreviewConfig';
import type { TrustState } from '@mdx-preview/contracts';
import { createMockPreview } from '../../helpers/mock-preview';
import { mockFrameworkDetector, mockErrorReporter } from '../../helpers/mock-services';

function createTailwindConfig(
  overrides: Partial<TailwindConfig> = {}
): TailwindConfig {
  return {
    enabled: 'enabled',
    maxFileSizeBytes: 1024 * 1024,
    maxCssFilesToSearch: 50,
    cacheMaxEntries: 5,
    cacheTtlSeconds: 60,
    compilationTimeout: 1000,
    ...overrides,
  };
}

const trustedState: TrustState = {
  workspaceTrusted: true,
  scriptsEnabled: true,
  canExecute: true,
  openMdxLinksInPreview: true,
};

const safeState: TrustState = {
  workspaceTrusted: true,
  scriptsEnabled: true,
  canExecute: false,
  openMdxLinksInPreview: true,
};

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('TailwindProcessor', () => {
  beforeEach(() => {
    TailwindProcessor.reset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    TailwindProcessor.reset();
  });

  it('returns disabled when trust state blocks execution', async () => {
    const processor = TailwindProcessor.getInstance();
    const preview = createMockPreview() as any;

    const result = await processor.process({
      preview,
      mdxText: '# Test',
      entryFilePath: preview.fsPath,
      entryFileDependencies: [],
      trustState: safeState,
      tailwindConfig: createTailwindConfig(),
    });

    expect(result.enabled).toBe(false);
    expect(result.profile).toBe('disabled');
    expect(result.css).toBe('');
    expect(result.watchFiles).toEqual([]);
  });

  it('returns disabled when tailwind is disabled', async () => {
    const processor = TailwindProcessor.getInstance();
    const preview = createMockPreview() as any;

    const result = await processor.process({
      preview,
      mdxText: '# Test',
      entryFilePath: preview.fsPath,
      entryFileDependencies: [],
      trustState: trustedState,
      tailwindConfig: createTailwindConfig({ enabled: 'disabled' }),
    });

    expect(result.enabled).toBe(false);
    expect(result.profile).toBe('disabled');
    expect(result.css).toBe('');
  });

  it('returns disabled when auto mode has no config or entry CSS', async () => {
    const processor = TailwindProcessor.getInstance();
    const preview = createMockPreview() as any;

    const detector = (processor as any).detector;
    vi.spyOn(detector, 'resolveWorkspaceRoot').mockReturnValue('/workspace');
    vi.spyOn(detector, 'resolveConfigPath').mockReturnValue(null);
    vi.spyOn(detector, 'resolveEntryCssPath').mockResolvedValue(null);

    const result = await processor.process({
      preview,
      mdxText: '# Test',
      entryFilePath: preview.fsPath,
      entryFileDependencies: [],
      trustState: trustedState,
      tailwindConfig: createTailwindConfig({ enabled: 'auto' }),
    });

    expect(result.enabled).toBe(false);
    expect(result.profile).toBe('disabled');
    expect(result.css).toBe('');
  });

  it('returns compiled CSS and watch files when config is present', async () => {
    const processor = TailwindProcessor.getInstance();
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'mdx-preview-tailwind-')
    );
    tempDirs.push(tempDir);

    const configPath = path.join(tempDir, 'tailwind.config.js');
    const cssPath = path.join(tempDir, 'tailwind.css');
    fs.writeFileSync(configPath, 'module.exports = {}', 'utf-8');
    fs.writeFileSync(cssPath, '@tailwind base;', 'utf-8');

    const preview = createMockPreview({
      fsPath: path.join(tempDir, 'doc.mdx'),
    }) as any;

    const detector = (processor as any).detector;
    const scanner = (processor as any).scanner;
    const compiler = (processor as any).compiler;
    const cache = (processor as any).cache;

    vi.spyOn(detector, 'resolveWorkspaceRoot').mockReturnValue(tempDir);
    vi.spyOn(detector, 'resolveConfigPath').mockReturnValue(configPath);
    vi.spyOn(detector, 'resolveEntryCssPath').mockResolvedValue(cssPath);
    vi.spyOn(detector, 'getWorkspaceTailwindVersion').mockReturnValue({
      version: '4.0.0',
      major: 4,
    });
    vi.spyOn(scanner, 'scan').mockResolvedValue({
      classList: ['text-red-500'],
      scannedFiles: [],
    });
    vi.spyOn(compiler, 'compile').mockResolvedValue('/* compiled */');
    vi.spyOn(cache, 'get').mockReturnValue(null);
    vi.spyOn(cache, 'set').mockImplementation(() => undefined);
    vi.spyOn(processor as any, 'getFileStamp').mockResolvedValue('stamp');

    const result = await processor.process({
      preview,
      mdxText: '# Test',
      entryFilePath: preview.fsPath,
      entryFileDependencies: [],
      trustState: trustedState,
      tailwindConfig: createTailwindConfig(),
    });

    expect(result.enabled).toBe(true);
    expect(result.profile).toBe('advanced');
    expect(result.css).toBe('/* compiled */');
    expect(result.watchFiles).toEqual([configPath, cssPath].sort());
  });

  it('uses browser profile when workspace is CSS-first', async () => {
    const processor = TailwindProcessor.getInstance();
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'mdx-preview-tailwind-browser-')
    );
    tempDirs.push(tempDir);

    const cssPath = path.join(tempDir, 'tailwind.css');
    fs.writeFileSync(cssPath, '@import "tailwindcss";', 'utf-8');

    const preview = createMockPreview({
      fsPath: path.join(tempDir, 'doc.mdx'),
    }) as any;

    const detector = (processor as any).detector;
    const compiler = (processor as any).compiler;
    const scanner = (processor as any).scanner;

    vi.spyOn(detector, 'resolveWorkspaceRoot').mockReturnValue(tempDir);
    vi.spyOn(detector, 'detectProfile').mockResolvedValue({
      profile: 'browser',
      reason: 'No tailwind.config.* or plugin directives detected',
      workspaceRoot: tempDir,
      configPath: null,
      entryCssPath: cssPath,
      hasTailwindInput: true,
      inlineTailwindStyles: [],
    });
    const compileSpy = vi.spyOn(compiler, 'compile');
    const scanSpy = vi.spyOn(scanner, 'scan');

    const result = await processor.process({
      preview,
      mdxText: '# Test',
      entryFilePath: preview.fsPath,
      entryFileDependencies: [],
      trustState: trustedState,
      tailwindConfig: createTailwindConfig(),
    });

    expect(result.enabled).toBe(true);
    expect(result.profile).toBe('browser');
    expect(result.css).toContain('@import "tailwindcss";');
    expect(result.watchFiles).toEqual([cssPath]);
    expect(compileSpy).not.toHaveBeenCalled();
    expect(scanSpy).not.toHaveBeenCalled();
  });

  it('enables browser profile in auto mode when inline Tailwind CSS input exists', async () => {
    const processor = TailwindProcessor.getInstance();
    const preview = createMockPreview() as any;

    const detector = (processor as any).detector;
    vi.spyOn(detector, 'resolveWorkspaceRoot').mockReturnValue('/workspace');
    vi.spyOn(detector, 'detectProfile').mockResolvedValue({
      profile: 'browser',
      reason: 'No tailwind.config.* or plugin directives detected',
      workspaceRoot: '/workspace',
      configPath: null,
      entryCssPath: null,
      hasTailwindInput: true,
      inlineTailwindStyles: ['@theme { --color-brand: #123456; }'],
    });

    const result = await processor.process({
      preview,
      mdxText:
        '<style type="text/tailwindcss">@theme { --color-brand: #123456; }</style>',
      entryFilePath: preview.fsPath,
      entryFileDependencies: [],
      trustState: trustedState,
      tailwindConfig: createTailwindConfig({ enabled: 'auto' }),
    });

    expect(result.enabled).toBe(true);
    expect(result.profile).toBe('browser');
    expect(result.css).toContain('@theme');
  });

  it('invalidates specific scan cache entry when fsPath is provided', () => {
    const processor = TailwindProcessor.getInstance();
    const scanCache = (processor as any).scanCache;
    const deleteSpy = vi.spyOn(scanCache, 'delete').mockReturnValue(true);

    processor.invalidateScanCache('/workspace/components/Card.tsx');

    expect(deleteSpy).toHaveBeenCalledWith('/workspace/components/Card.tsx');
  });

  it('clears scan cache when fsPath is not provided', () => {
    const processor = TailwindProcessor.getInstance();
    const scanCache = (processor as any).scanCache;
    const clearSpy = vi
      .spyOn(scanCache, 'clear')
      .mockImplementation(() => undefined);

    processor.invalidateScanCache();

    expect(clearSpy).toHaveBeenCalledTimes(1);
  });
});
