import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import {
  __setMockWorkspaceFolders,
  __resetMocks,
  Uri,
} from './__mocks__/vscode';
import type { Preview } from '../preview/preview-manager';
import type * as vscode from 'vscode';
import type { TrustState } from '../security/TrustManager';
import type { ConfigurationState } from '../preview/PreviewConfiguration';

// helper to create mock TrustState with required properties
const mockTrustState = (
  canExecute: boolean,
  reason: string = ''
): TrustState => ({
  workspaceTrusted: canExecute,
  scriptsEnabled: canExecute,
  canExecute,
  reason,
});

// helper to create mock ConfigurationState with required properties
const mockConfigState = (
  tailwindEnabled: 'auto' | 'enabled' | 'disabled'
): ConfigurationState =>
  ({
    updateMode: 'onType',
    debounceDelay: 300,
    useVscodeMarkdownStyles: true,
    useWhiteBackground: false,
    customLayoutFilePath: '',
    customCss: '',
    useSucraseTranspiler: false,
    securityPolicy: 'strict',
    tailwindEnabled,
  }) as ConfigurationState;

vi.mock('fs');
vi.mock('../logging', () => ({
  debug: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
}));

// mock sub-modules
const mockDetector = {
  resolveWorkspaceRoot: vi.fn(),
  resolveConfigPath: vi.fn(),
  resolveEntryCssPath: vi.fn(),
  getWorkspaceTailwindVersion: vi.fn(),
  invalidateVersionCache: vi.fn(),
};

const mockScanner = {
  scan: vi.fn(),
};

const mockCache = {
  get: vi.fn(),
  set: vi.fn(),
  clear: vi.fn(),
  updateSettings: vi.fn(),
};

const mockCompiler = {
  compile: vi.fn(),
};

vi.mock('../tailwind/TailwindDetector', () => ({
  TailwindDetector: vi.fn(() => mockDetector),
}));

vi.mock('../tailwind/TailwindScanner', () => ({
  TailwindScanner: vi.fn(() => mockScanner),
}));

vi.mock('../tailwind/TailwindCache', () => ({
  TailwindCache: vi.fn(() => mockCache),
}));

vi.mock('../tailwind/TailwindCompiler', () => ({
  TailwindCompiler: vi.fn(() => mockCompiler),
}));

// import after mocks are set up
import { TailwindProcessor } from '../tailwind/TailwindProcessor';
import { warn } from '../logging';

// helper to create mock Preview
const createMockPreview = (overrides: Partial<Preview> = {}): Preview => {
  let tailwindRequestId = 0;
  const defaultConfig = mockConfigState('auto');
  return {
    doc: {
      uri: Uri.file('/workspace/src/page.mdx'),
    } as vscode.TextDocument,
    entryFsDirectory: '/workspace/src',
    configuration: defaultConfig,
    mdxPreviewConfig: null,
    webviewHandle: {},
    webviewHandshakePromise: Promise.resolve(),
    nextTailwindRequestId: vi.fn(() => ++tailwindRequestId),
    isTailwindRequestCurrent: vi.fn(() => true),
    ...overrides,
  } as unknown as Preview;
};

// helper to reset singleton
const resetProcessor = (): void => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (TailwindProcessor as any).instance = undefined;
};

describe('TailwindProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetMocks();
    resetProcessor();

    __setMockWorkspaceFolders([{ uri: { fsPath: '/workspace' } }]);

    // Default mock behaviors
    mockDetector.resolveWorkspaceRoot.mockReturnValue('/workspace');
    mockDetector.resolveConfigPath.mockReturnValue(
      '/workspace/tailwind.config.js'
    );
    mockDetector.resolveEntryCssPath.mockResolvedValue(
      '/workspace/src/globals.css'
    );
    mockDetector.getWorkspaceTailwindVersion.mockReturnValue({
      version: '3.4.1',
      major: 3,
      modulePath: '/workspace/node_modules/tailwindcss',
    });

    mockScanner.scan.mockResolvedValue({
      classList: ['flex', 'gap-2', 'p-4'],
      scannedFiles: [],
    });

    mockCache.get.mockReturnValue(null);

    mockCompiler.compile.mockResolvedValue('.flex { display: flex; }');

    // Mock file stats
    vi.spyOn(fs.promises, 'stat').mockResolvedValue({
      mtimeMs: 1704067200000, // 2024-01-01
    } as fs.Stats);
  });

  afterEach(() => {
    resetProcessor();
  });

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const instance1 = TailwindProcessor.getInstance();
      const instance2 = TailwindProcessor.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('trust state handling', () => {
    it('should return early with enabled=false when canExecute is false', async () => {
      const processor = TailwindProcessor.getInstance();
      const preview = createMockPreview();

      const result = await processor.process({
        preview,
        mdxText: '# Hello',
        entryFilePath: '/workspace/src/page.mdx',
        entryFileDependencies: [],
        trustState: mockTrustState(false, 'Untrusted workspace'),
      });

      expect(result).toEqual({
        css: '',
        watchFiles: [],
        enabled: false,
      });
      expect(mockScanner.scan).not.toHaveBeenCalled();
      expect(mockCompiler.compile).not.toHaveBeenCalled();
    });

    it('should process normally when canExecute is true', async () => {
      const processor = TailwindProcessor.getInstance();
      const preview = createMockPreview();

      const result = await processor.process({
        preview,
        mdxText: '# Hello',
        entryFilePath: '/workspace/src/page.mdx',
        entryFileDependencies: [],
        trustState: mockTrustState(true),
      });

      expect(result.enabled).toBe(true);
      expect(mockScanner.scan).toHaveBeenCalled();
    });
  });

  describe('settings management', () => {
    it('should update cache settings on process', async () => {
      const processor = TailwindProcessor.getInstance();
      const preview = createMockPreview();

      await processor.process({
        preview,
        mdxText: '# Hello',
        entryFilePath: '/workspace/src/page.mdx',
        entryFileDependencies: [],
        trustState: mockTrustState(true),
      });

      expect(mockCache.updateSettings).toHaveBeenCalledWith({
        maxEntries: expect.any(Number),
        ttlMs: expect.any(Number),
      });
    });
  });

  describe('version detection', () => {
    it('should return early for unsupported v2 version', async () => {
      mockDetector.getWorkspaceTailwindVersion.mockReturnValue({
        version: '2.2.19',
        major: 2,
      });

      const processor = TailwindProcessor.getInstance();
      const preview = createMockPreview();

      const result = await processor.process({
        preview,
        mdxText: '# Hello',
        entryFilePath: '/workspace/src/page.mdx',
        entryFileDependencies: [],
        trustState: mockTrustState(true),
      });

      expect(result).toEqual({
        css: '',
        watchFiles: [],
        enabled: false,
      });
      expect(mockCompiler.compile).not.toHaveBeenCalled();
    });

    it('should return early for unsupported v1 version', async () => {
      mockDetector.getWorkspaceTailwindVersion.mockReturnValue({
        version: '1.9.6',
        major: 1,
      });

      const processor = TailwindProcessor.getInstance();
      const preview = createMockPreview();

      const result = await processor.process({
        preview,
        mdxText: '# Hello',
        entryFilePath: '/workspace/src/page.mdx',
        entryFileDependencies: [],
        trustState: mockTrustState(true),
      });

      expect(result.enabled).toBe(false);
    });

    it('should warn for future v5 version but still process', async () => {
      mockDetector.getWorkspaceTailwindVersion.mockReturnValue({
        version: '5.0.0',
        major: 5,
      });

      const processor = TailwindProcessor.getInstance();
      const preview = createMockPreview();

      const result = await processor.process({
        preview,
        mdxText: '# Hello',
        entryFilePath: '/workspace/src/page.mdx',
        entryFileDependencies: [],
        trustState: mockTrustState(true),
      });

      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('Tailwind v5 detected')
      );
      expect(result.enabled).toBe(true);
    });

    it('should process v3 correctly', async () => {
      mockDetector.getWorkspaceTailwindVersion.mockReturnValue({
        version: '3.4.1',
        major: 3,
        modulePath: '/workspace/node_modules/tailwindcss',
      });

      const processor = TailwindProcessor.getInstance();
      const preview = createMockPreview();

      await processor.process({
        preview,
        mdxText: '# Hello',
        entryFilePath: '/workspace/src/page.mdx',
        entryFileDependencies: [],
        trustState: mockTrustState(true),
      });

      expect(mockCompiler.compile).toHaveBeenCalledWith(
        expect.objectContaining({
          tailwindVersion: 'v3',
          workspaceTailwindPath: '/workspace/node_modules/tailwindcss',
        })
      );
    });

    it('should process v4 correctly', async () => {
      mockDetector.getWorkspaceTailwindVersion.mockReturnValue({
        version: '4.0.0',
        major: 4,
      });

      const processor = TailwindProcessor.getInstance();
      const preview = createMockPreview();

      await processor.process({
        preview,
        mdxText: '# Hello',
        entryFilePath: '/workspace/src/page.mdx',
        entryFileDependencies: [],
        trustState: mockTrustState(true),
      });

      expect(mockCompiler.compile).toHaveBeenCalledWith(
        expect.objectContaining({
          tailwindVersion: 'v4',
          workspaceTailwindPath: undefined,
        })
      );
    });

    it('should handle null major version gracefully', async () => {
      mockDetector.getWorkspaceTailwindVersion.mockReturnValue({
        version: null,
        major: null,
      });

      const processor = TailwindProcessor.getInstance();
      const preview = createMockPreview();

      // Should not throw, defaults to v4
      const result = await processor.process({
        preview,
        mdxText: '# Hello',
        entryFilePath: '/workspace/src/page.mdx',
        entryFileDependencies: [],
        trustState: mockTrustState(true),
      });

      expect(result.enabled).toBe(true);
    });
  });

  describe('cache behavior', () => {
    it('should return cached CSS on cache hit', async () => {
      mockCache.get.mockReturnValue('.cached { color: red; }');

      const processor = TailwindProcessor.getInstance();
      const preview = createMockPreview();

      const result = await processor.process({
        preview,
        mdxText: '# Hello',
        entryFilePath: '/workspace/src/page.mdx',
        entryFileDependencies: [],
        trustState: mockTrustState(true),
      });

      expect(result.css).toBe('.cached { color: red; }');
      expect(mockCompiler.compile).not.toHaveBeenCalled();
    });

    it('should compile and cache on cache miss', async () => {
      mockCache.get.mockReturnValue(null);
      mockCompiler.compile.mockResolvedValue('.compiled { color: blue; }');

      const processor = TailwindProcessor.getInstance();
      const preview = createMockPreview();

      const result = await processor.process({
        preview,
        mdxText: '# Hello',
        entryFilePath: '/workspace/src/page.mdx',
        entryFileDependencies: [],
        trustState: mockTrustState(true),
      });

      expect(result.css).toBe('.compiled { color: blue; }');
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.any(String),
        '.compiled { color: blue; }'
      );
    });
  });

  describe('file stamp handling', () => {
    it('should return unique error stamp on file stat failure', async () => {
      vi.spyOn(fs.promises, 'stat').mockRejectedValue(
        new Error('ENOENT: no such file')
      );

      const processor = TailwindProcessor.getInstance();
      const preview = createMockPreview();

      // Process twice to verify different cache keys due to error stamp
      await processor.process({
        preview,
        mdxText: '# Hello',
        entryFilePath: '/workspace/src/page.mdx',
        entryFileDependencies: [],
        trustState: mockTrustState(true),
      });

      // Should have called compiler (not cached due to error stamp)
      expect(mockCompiler.compile).toHaveBeenCalled();
    });

    it('should use file mtime for cache key when file exists', async () => {
      vi.spyOn(fs.promises, 'stat').mockResolvedValue({
        mtimeMs: 1704067200000,
      } as fs.Stats);

      const processor = TailwindProcessor.getInstance();
      const preview = createMockPreview();

      await processor.process({
        preview,
        mdxText: '# Hello',
        entryFilePath: '/workspace/src/page.mdx',
        entryFileDependencies: [],
        trustState: mockTrustState(true),
      });

      expect(fs.promises.stat).toHaveBeenCalledWith(
        '/workspace/tailwind.config.js'
      );
      expect(fs.promises.stat).toHaveBeenCalledWith(
        '/workspace/src/globals.css'
      );
    });
  });

  describe('disabled/auto mode', () => {
    it('should return early when tailwind disabled', async () => {
      const processor = TailwindProcessor.getInstance();
      const preview = createMockPreview({
        configuration: mockConfigState('disabled'),
      });

      const result = await processor.process({
        preview,
        mdxText: '# Hello',
        entryFilePath: '/workspace/src/page.mdx',
        entryFileDependencies: [],
        trustState: mockTrustState(true),
      });

      expect(result.enabled).toBe(false);
      expect(mockScanner.scan).not.toHaveBeenCalled();
    });

    it('should return early in auto mode with no config or CSS', async () => {
      mockDetector.resolveConfigPath.mockReturnValue(null);
      mockDetector.resolveEntryCssPath.mockResolvedValue(null);

      const processor = TailwindProcessor.getInstance();
      const preview = createMockPreview({
        configuration: mockConfigState('auto'),
      });

      const result = await processor.process({
        preview,
        mdxText: '# Hello',
        entryFilePath: '/workspace/src/page.mdx',
        entryFileDependencies: [],
        trustState: mockTrustState(true),
      });

      expect(result.enabled).toBe(false);
    });

    it('should process in auto mode when config exists', async () => {
      mockDetector.resolveEntryCssPath.mockResolvedValue(null);
      // Config still exists from default mock

      const processor = TailwindProcessor.getInstance();
      const preview = createMockPreview({
        configuration: mockConfigState('auto'),
      });

      const result = await processor.process({
        preview,
        mdxText: '# Hello',
        entryFilePath: '/workspace/src/page.mdx',
        entryFileDependencies: [],
        trustState: mockTrustState(true),
      });

      expect(result.enabled).toBe(true);
    });
  });

  describe('watch files', () => {
    it('should include config and entry CSS in watch files', async () => {
      const processor = TailwindProcessor.getInstance();
      const preview = createMockPreview();

      const result = await processor.process({
        preview,
        mdxText: '# Hello',
        entryFilePath: '/workspace/src/page.mdx',
        entryFileDependencies: [],
        trustState: mockTrustState(true),
      });

      expect(result.watchFiles).toContain('/workspace/tailwind.config.js');
      expect(result.watchFiles).toContain('/workspace/src/globals.css');
    });

    it('should handle missing config or CSS paths', async () => {
      mockDetector.resolveConfigPath.mockReturnValue(null);
      mockDetector.resolveEntryCssPath.mockResolvedValue(null);

      const processor = TailwindProcessor.getInstance();
      const preview = createMockPreview({
        configuration: mockConfigState('enabled'),
      });

      const result = await processor.process({
        preview,
        mdxText: '# Hello',
        entryFilePath: '/workspace/src/page.mdx',
        entryFileDependencies: [],
        trustState: mockTrustState(true),
      });

      expect(result.watchFiles).toEqual([]);
    });

    it('should return watchFiles in sorted order for determinism', async () => {
      // Set up paths that would be unsorted if not explicitly sorted
      mockDetector.resolveConfigPath.mockReturnValue(
        '/workspace/z-tailwind.config.js'
      );
      mockDetector.resolveEntryCssPath.mockResolvedValue(
        '/workspace/a-styles.css'
      );

      const processor = TailwindProcessor.getInstance();
      const preview = createMockPreview();

      const result = await processor.process({
        preview,
        mdxText: '# Hello',
        entryFilePath: '/workspace/src/page.mdx',
        entryFileDependencies: [],
        trustState: mockTrustState(true),
      });

      // Should be sorted alphabetically
      expect(result.watchFiles).toEqual([
        '/workspace/a-styles.css',
        '/workspace/z-tailwind.config.js',
      ]);
    });
  });

  describe('error handling', () => {
    it('should return empty result on compilation failure', async () => {
      mockCompiler.compile.mockRejectedValue(new Error('PostCSS error'));

      const processor = TailwindProcessor.getInstance();
      const preview = createMockPreview();

      const result = await processor.process({
        preview,
        mdxText: '# Hello',
        entryFilePath: '/workspace/src/page.mdx',
        entryFileDependencies: [],
        trustState: mockTrustState(true),
      });

      expect(result).toEqual({
        css: '',
        watchFiles: [],
        enabled: false,
      });
    });
  });

  describe('invalidateVersionCache', () => {
    it('should delegate to detector', () => {
      const processor = TailwindProcessor.getInstance();
      processor.invalidateVersionCache('/workspace');

      expect(mockDetector.invalidateVersionCache).toHaveBeenCalledWith(
        '/workspace'
      );
    });

    it('should handle undefined workspace', () => {
      const processor = TailwindProcessor.getInstance();
      processor.invalidateVersionCache();

      expect(mockDetector.invalidateVersionCache).toHaveBeenCalledWith(
        undefined
      );
    });
  });
});
