// packages/extension/test/transform.test.ts
// tests for transform module - transpiles entry and dependency files

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Preview } from '../preview/preview-manager';

// mock dependencies before importing transform
vi.mock('../transpiler/mdx/mdx', () => ({
  mdxTranspileAsync: vi.fn(),
}));

vi.mock('typescript', () => ({
  transpileModule: vi.fn(),
}));

vi.mock('../transpiler/transpiler-selector', () => ({
  transpileWithFallback: vi.fn(),
}));

vi.mock('../preview/config', () => ({
  resolveTypescriptConfig: vi.fn(),
}));

vi.mock('is-module', () => ({
  default: vi.fn(),
}));

import { transformEntry, transform } from '../module-fetcher/transform';
import { mdxTranspileAsync } from '../transpiler/mdx/mdx';
import { transpileModule as tsTranspileModule } from 'typescript';
import { transpileWithFallback } from '../transpiler/transpiler-selector';
import { resolveTypescriptConfig } from '../preview/config';
import isModule from 'is-module';

describe('transform', () => {
  let mockPreview: Preview;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default preview mock
    mockPreview = {
      doc: {
        languageId: 'javascript',
        uri: { scheme: 'file' },
      },
      configuration: {
        useSucraseTranspiler: false,
      },
      typescriptConfiguration: undefined,
    } as unknown as Preview;

    // Default mocks
    vi.mocked(mdxTranspileAsync).mockResolvedValue({
      code: 'mdx compiled code',
      frontmatter: {},
    });
    vi.mocked(tsTranspileModule).mockReturnValue({
      outputText: 'ts transpiled code',
    } as any);
    vi.mocked(transpileWithFallback).mockResolvedValue('transpiled code');
    vi.mocked(resolveTypescriptConfig).mockReturnValue({
      tsCompilerOptions: {},
    } as any);
    vi.mocked(isModule).mockReturnValue(false);
  });

  describe('transformEntry', () => {
    it('compiles MDX when languageId is mdx', async () => {
      mockPreview.doc.languageId = 'mdx';
      const code = '# Hello MDX';

      await transformEntry(code, '/path/to/file.mdx', mockPreview);

      expect(mdxTranspileAsync).toHaveBeenCalledWith(code, true, mockPreview);
    });

    it('compiles MDX when languageId is markdown', async () => {
      mockPreview.doc.languageId = 'markdown';
      const code = '# Hello Markdown';

      await transformEntry(code, '/path/to/file.md', mockPreview);

      expect(mdxTranspileAsync).toHaveBeenCalledWith(code, true, mockPreview);
    });

    it('compiles MDX when uri scheme is untitled', async () => {
      mockPreview.doc.uri.scheme = 'untitled';
      const code = '# Untitled document';

      await transformEntry(code, 'Untitled-1', mockPreview);

      expect(mdxTranspileAsync).toHaveBeenCalledWith(code, true, mockPreview);
    });

    it('extracts frontmatter from MDX', async () => {
      mockPreview.doc.languageId = 'mdx';
      const frontmatter = { title: 'Test', author: 'User' };
      vi.mocked(mdxTranspileAsync).mockResolvedValue({
        code: 'compiled',
        frontmatter,
      });

      const result = await transformEntry('', '/path/to/file.mdx', mockPreview);

      expect(result.frontmatter).toEqual(frontmatter);
    });

    it('uses TypeScript compiler for typescript files when not using Sucrase', async () => {
      mockPreview.doc.languageId = 'typescript';
      mockPreview.configuration.useSucraseTranspiler = false;

      await transformEntry(
        'const x: number = 1;',
        '/path/to/file.ts',
        mockPreview
      );

      expect(tsTranspileModule).toHaveBeenCalled();
    });

    it('uses TypeScript compiler for typescriptreact files when not using Sucrase', async () => {
      mockPreview.doc.languageId = 'typescriptreact';
      mockPreview.configuration.useSucraseTranspiler = false;

      await transformEntry(
        'const App: FC = () => <div/>;',
        '/path/to/file.tsx',
        mockPreview
      );

      expect(tsTranspileModule).toHaveBeenCalled();
    });

    it('skips TypeScript compiler when useSucrase is true', async () => {
      mockPreview.doc.languageId = 'typescript';
      mockPreview.configuration.useSucraseTranspiler = true;

      await transformEntry(
        'const x: number = 1;',
        '/path/to/file.ts',
        mockPreview
      );

      expect(tsTranspileModule).not.toHaveBeenCalled();
    });

    it('resolves TypeScript config if not already set', async () => {
      mockPreview.doc.languageId = 'typescript';
      mockPreview.typescriptConfiguration = undefined;

      await transformEntry(
        'const x: number = 1;',
        '/path/to/file.ts',
        mockPreview
      );

      expect(resolveTypescriptConfig).toHaveBeenCalledWith(null);
    });

    it('uses cached TypeScript config if available', async () => {
      mockPreview.doc.languageId = 'typescript';
      mockPreview.typescriptConfiguration = { tsCompilerOptions: {} } as any;

      await transformEntry(
        'const x: number = 1;',
        '/path/to/file.ts',
        mockPreview
      );

      expect(resolveTypescriptConfig).not.toHaveBeenCalled();
    });

    it('calls transpileWithFallback with Sucrase when configured', async () => {
      mockPreview.configuration.useSucraseTranspiler = true;

      await transformEntry('const x = 1;', '/path/to/file.js', mockPreview);

      expect(transpileWithFallback).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          useSucrase: true,
          context: 'entry',
        })
      );
    });

    it('calls transpileWithFallback with Babel when not configured for Sucrase', async () => {
      mockPreview.configuration.useSucraseTranspiler = false;

      await transformEntry('const x = 1;', '/path/to/file.js', mockPreview);

      expect(transpileWithFallback).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          useSucrase: false,
          context: 'entry',
        })
      );
    });

    it('passes filePath to transpileWithFallback', async () => {
      const fsPath = '/workspace/src/entry.tsx';

      await transformEntry('', fsPath, mockPreview);

      expect(transpileWithFallback).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          filePath: fsPath,
        })
      );
    });

    it('returns compiled code', async () => {
      vi.mocked(transpileWithFallback).mockResolvedValue(
        'final transpiled code'
      );

      const result = await transformEntry('', '/path/to/file.js', mockPreview);

      expect(result.code).toBe('final transpiled code');
    });

    it('returns empty frontmatter when not MDX', async () => {
      mockPreview.doc.languageId = 'javascript';

      const result = await transformEntry(
        'const x = 1;',
        '/path/to/file.js',
        mockPreview
      );

      expect(result.frontmatter).toEqual({});
    });
  });

  describe('transform (dependency)', () => {
    it('compiles MDX for .mdx files', async () => {
      const code = '# MDX Dependency';

      await transform(code, '/path/to/dep.mdx', mockPreview);

      expect(mdxTranspileAsync).toHaveBeenCalledWith(code, false, mockPreview);
    });

    it('compiles MDX for .md files', async () => {
      const code = '# Markdown Dependency';

      await transform(code, '/path/to/dep.md', mockPreview);

      expect(mdxTranspileAsync).toHaveBeenCalledWith(code, false, mockPreview);
    });

    it('does not compile MDX for non-MDX files', async () => {
      await transform('const x = 1;', '/path/to/dep.js', mockPreview);

      expect(mdxTranspileAsync).not.toHaveBeenCalled();
    });

    it('uses TypeScript compiler for .ts files', async () => {
      mockPreview.configuration.useSucraseTranspiler = false;

      await transform('const x: number = 1;', '/path/to/dep.ts', mockPreview);

      expect(tsTranspileModule).toHaveBeenCalled();
    });

    it('uses TypeScript compiler for .tsx files', async () => {
      mockPreview.configuration.useSucraseTranspiler = false;

      await transform(
        'const App: FC = () => <div/>;',
        '/path/to/dep.tsx',
        mockPreview
      );

      expect(tsTranspileModule).toHaveBeenCalled();
    });

    it('skips TypeScript compiler when useSucrase is true', async () => {
      mockPreview.configuration.useSucraseTranspiler = true;

      await transform('const x: number = 1;', '/path/to/dep.ts', mockPreview);

      expect(tsTranspileModule).not.toHaveBeenCalled();
    });

    it('prefers Sucrase for node_modules ESM dependencies', async () => {
      // ESM module in node_modules - should use Sucrase
      vi.mocked(isModule).mockReturnValue(true);

      await transform(
        'export const x = 1;',
        '/path/to/node_modules/pkg/index.js',
        mockPreview
      );

      expect(transpileWithFallback).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          useSucrase: true,
          context: 'dependency',
        })
      );
    });

    it('uses configured transpiler for non-node_modules dependencies', async () => {
      mockPreview.configuration.useSucraseTranspiler = false;

      await transform('const x = 1;', '/path/to/src/utils.js', mockPreview);

      expect(transpileWithFallback).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          useSucrase: false,
        })
      );
    });

    it('transpiles node_modules ESM modules', async () => {
      vi.mocked(isModule).mockReturnValue(true);

      await transform(
        'export const x = 1;',
        '/path/to/node_modules/pkg/index.js',
        mockPreview
      );

      expect(transpileWithFallback).toHaveBeenCalled();
    });

    it('skips transpilation for node_modules CommonJS modules', async () => {
      vi.mocked(isModule).mockReturnValue(false);

      await transform(
        'module.exports = {};',
        '/path/to/node_modules/pkg/index.js',
        mockPreview
      );

      // Transpilation is called because isInNodeModules=true but isModule=false
      // means !isInNodeModules || isModule(code) = false || false = false
      // So transpileWithFallback should NOT be called
      expect(transpileWithFallback).not.toHaveBeenCalled();
    });

    it('returns transformed code', async () => {
      vi.mocked(transpileWithFallback).mockResolvedValue(
        'transformed dependency code'
      );

      const result = await transform('', '/path/to/dep.js', mockPreview);

      expect(result).toBe('transformed dependency code');
    });

    it('passes filePath to transpileWithFallback', async () => {
      const fsPath = '/workspace/src/utils/helper.ts';

      await transform('', fsPath, mockPreview);

      expect(transpileWithFallback).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          filePath: fsPath,
        })
      );
    });

    it('detects node_modules in path correctly', async () => {
      // Windows-style path with node_modules
      vi.mocked(isModule).mockReturnValue(false);

      // This should detect node_modules and skip transpilation for CommonJS
      await transform(
        'module.exports = 1;',
        '/path/node_modules/pkg/dist/index.js',
        mockPreview
      );

      expect(transpileWithFallback).not.toHaveBeenCalled();
    });

    it('handles nested node_modules paths', async () => {
      vi.mocked(isModule).mockReturnValue(true);

      await transform(
        'export default 1;',
        '/path/node_modules/a/node_modules/b/index.js',
        mockPreview
      );

      expect(transpileWithFallback).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          useSucrase: true,
        })
      );
    });
  });
});
