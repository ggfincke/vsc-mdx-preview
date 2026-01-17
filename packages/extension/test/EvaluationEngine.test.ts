// packages/extension/test/EvaluationEngine.test.ts
// unit tests for EvaluationEngine (timeout handling, evaluation modes)

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { __resetMocks, __setMockConfig } from './__mocks__/vscode';

// Use vi.hoisted to create mock functions that are available during vi.mock hoisting
const {
  mockTransformEntry,
  mockCompileToSafeHTML,
  mockExtractImports,
  mockRealpath,
  mockTailwindProcess,
  mockReportError,
} = vi.hoisted(() => ({
  mockTransformEntry: vi.fn(),
  mockCompileToSafeHTML: vi.fn(),
  mockExtractImports: vi.fn(),
  mockRealpath: vi.fn(),
  mockTailwindProcess: vi.fn(),
  mockReportError: vi.fn(),
}));

// Mock external dependencies before importing EvaluationEngine
vi.mock('../module-fetcher/transform', () => ({
  transformEntry: mockTransformEntry,
}));

vi.mock('../transpiler/mdx/mdx-safe', () => ({
  compileToSafeHTML: mockCompileToSafeHTML,
}));

vi.mock('../module-fetcher/import-extractor', () => ({
  extractImportSpecifiers: mockExtractImports,
}));

vi.mock('fs', () => ({
  promises: {
    realpath: mockRealpath,
    readFile: vi.fn().mockResolvedValue('# Test'),
  },
}));

vi.mock('../services', () => ({
  getTailwindProcessor: () => ({
    process: mockTailwindProcess,
  }),
  getErrorReporter: () => ({
    report: mockReportError,
  }),
}));

import {
  EvaluationEngine,
  getEvaluationEngine,
} from '../preview/EvaluationEngine';

describe('EvaluationEngine', () => {
  let engine: EvaluationEngine;

  beforeEach(() => {
    __resetMocks();
    vi.clearAllMocks();

    // configure mock return values
    mockTransformEntry.mockResolvedValue({
      code: 'export default function MDXContent() { return null; }',
      frontmatter: { title: 'Test' },
    });
    mockCompileToSafeHTML.mockResolvedValue({
      html: '<h1>Test</h1>',
      frontmatter: { title: 'Test' },
    });
    mockExtractImports.mockResolvedValue(['react', './component']);
    mockRealpath.mockResolvedValue('/resolved/path/test.mdx');
    mockTailwindProcess.mockResolvedValue({
      css: '.test { color: red; }',
      watchFiles: ['/path/tailwind.config.js'],
    });

    engine = new EvaluationEngine();
  });

  afterEach(() => {
    __resetMocks();
    vi.clearAllMocks();
  });

  describe('getEvaluationEngine', () => {
    it('returns a singleton instance', () => {
      const instance1 = getEvaluationEngine();
      const instance2 = getEvaluationEngine();
      expect(instance1).toBe(instance2);
    });
  });

  describe('evaluateTrusted', () => {
    it('calls transformEntry with correct parameters', async () => {
      const mockPreview = {
        mdxPreviewConfig: undefined,
        typescriptConfiguration: {},
        configuration: { useSucraseTranspiler: false },
      } as any;

      await engine.evaluateTrusted('# Test', '/path/test.mdx', mockPreview);

      expect(mockTransformEntry).toHaveBeenCalledWith(
        '# Test',
        '/path/test.mdx',
        mockPreview
      );
    });

    it('returns code, entryFilePath, dependencies, and frontmatter', async () => {
      const mockPreview = {
        mdxPreviewConfig: undefined,
        typescriptConfiguration: {},
        configuration: { useSucraseTranspiler: false },
      } as any;

      const result = await engine.evaluateTrusted(
        '# Test',
        '/path/test.mdx',
        mockPreview
      );

      expect(result).toHaveProperty('code');
      expect(result).toHaveProperty('entryFilePath');
      expect(result).toHaveProperty('dependencies');
      expect(result).toHaveProperty('frontmatter');
      expect(result.dependencies).toEqual(['react', './component']);
    });

    it('extracts imports from compiled code', async () => {
      const mockPreview = {} as any;

      await engine.evaluateTrusted('# Test', '/path/test.mdx', mockPreview);

      expect(mockExtractImports).toHaveBeenCalled();
    });
  });

  describe('evaluateSafe', () => {
    it('calls compileToSafeHTML with correct parameters', async () => {
      const mdxConfig = { config: {}, configDir: '/config' };

      await engine.evaluateSafe('# Test', mdxConfig as any);

      expect(mockCompileToSafeHTML).toHaveBeenCalledWith('# Test', mdxConfig);
    });

    it('returns html and frontmatter', async () => {
      const result = await engine.evaluateSafe('# Test', undefined);

      expect(result).toHaveProperty('html');
      expect(result).toHaveProperty('frontmatter');
      expect(result.html).toBe('<h1>Test</h1>');
      expect(result.frontmatter).toEqual({ title: 'Test' });
    });
  });

  describe('withTimeout (via processTailwindAsync)', () => {
    it('processes Tailwind successfully when within timeout', async () => {
      __setMockConfig('tailwind.compilationTimeout', 5000);

      const mockPreview = {
        isTailwindRequestCurrent: vi.fn().mockReturnValue(true),
        updateTailwindWatchFiles: vi.fn(),
      } as any;

      const mockWebviewHandle = {
        setTailwindCss: vi.fn(),
      } as any;

      const params = {
        mdxText: '# Test',
        entryFilePath: '/path/test.mdx',
        entryFileDependencies: [],
        trustState: {
          canExecute: true,
          workspaceTrusted: true,
          scriptsEnabled: true,
        },
      };

      await engine.processTailwindAsync(
        mockPreview,
        params,
        1,
        mockWebviewHandle
      );

      expect(mockPreview.updateTailwindWatchFiles).toHaveBeenCalledWith([
        '/path/tailwind.config.js',
      ]);
      expect(mockWebviewHandle.setTailwindCss).toHaveBeenCalledWith(
        '.test { color: red; }'
      );
    });

    it('does not update webview if request is stale', async () => {
      const mockPreview = {
        isTailwindRequestCurrent: vi.fn().mockReturnValue(false),
        updateTailwindWatchFiles: vi.fn(),
      } as any;

      const mockWebviewHandle = {
        setTailwindCss: vi.fn(),
      } as any;

      const params = {
        mdxText: '# Test',
        entryFilePath: '/path/test.mdx',
        entryFileDependencies: [],
        trustState: {
          canExecute: true,
          workspaceTrusted: true,
          scriptsEnabled: true,
        },
      };

      await engine.processTailwindAsync(
        mockPreview,
        params,
        1,
        mockWebviewHandle
      );

      expect(mockPreview.updateTailwindWatchFiles).not.toHaveBeenCalled();
      expect(mockWebviewHandle.setTailwindCss).not.toHaveBeenCalled();
    });
  });
});
