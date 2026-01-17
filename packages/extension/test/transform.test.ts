// packages/extension/test/transform.test.ts
// tests for transform module - transpiles entry and dependency files

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Preview } from '../preview/preview-manager';

// stub dependencies before importing transform
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

// create mock preview for testing w/ configurable doc properties
function createMockPreview(
  options: {
    languageId?: string;
    scheme?: string;
    useSucraseTranspiler?: boolean;
    typescriptConfiguration?: any;
  } = {}
): Preview {
  return {
    doc: {
      languageId: options.languageId ?? 'javascript',
      uri: { scheme: options.scheme ?? 'file' },
    },
    configuration: {
      useSucraseTranspiler: options.useSucraseTranspiler ?? false,
    },
    typescriptConfiguration: options.typescriptConfiguration,
  } as unknown as Preview;
}

describe('transform', () => {
  let mockPreview: Preview;

  beforeEach(() => {
    vi.clearAllMocks();

    // configure preview mock
    mockPreview = createMockPreview();

    // configure default mocks
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
      const preview = createMockPreview({ languageId: 'mdx' });
      const code = '# Hello MDX';

      await transformEntry(code, '/path/to/file.mdx', preview);

      expect(mdxTranspileAsync).toHaveBeenCalledWith(code, true, preview);
    });

    it('compiles MDX when languageId is markdown', async () => {
      const preview = createMockPreview({ languageId: 'markdown' });
      const code = '# Hello Markdown';

      await transformEntry(code, '/path/to/file.md', preview);

      expect(mdxTranspileAsync).toHaveBeenCalledWith(code, true, preview);
    });

    it('compiles MDX when uri scheme is untitled', async () => {
      const preview = createMockPreview({ scheme: 'untitled' });
      const code = '# Untitled document';

      await transformEntry(code, 'Untitled-1', preview);

      expect(mdxTranspileAsync).toHaveBeenCalledWith(code, true, preview);
    });

    it('extracts frontmatter from MDX', async () => {
      const preview = createMockPreview({ languageId: 'mdx' });
      const frontmatter = { title: 'Test', author: 'User' };
      vi.mocked(mdxTranspileAsync).mockResolvedValue({
        code: 'compiled',
        frontmatter,
      });

      const result = await transformEntry('', '/path/to/file.mdx', preview);

      expect(result.frontmatter).toEqual(frontmatter);
    });

    it('uses TypeScript compiler for typescript files when not using Sucrase', async () => {
      const preview = createMockPreview({
        languageId: 'typescript',
        useSucraseTranspiler: false,
      });

      await transformEntry('const x: number = 1;', '/path/to/file.ts', preview);

      expect(tsTranspileModule).toHaveBeenCalled();
    });

    it('uses TypeScript compiler for typescriptreact files when not using Sucrase', async () => {
      const preview = createMockPreview({
        languageId: 'typescriptreact',
        useSucraseTranspiler: false,
      });

      await transformEntry(
        'const App: FC = () => <div/>;',
        '/path/to/file.tsx',
        preview
      );

      expect(tsTranspileModule).toHaveBeenCalled();
    });

    it('skips TypeScript compiler when useSucrase is enabled', async () => {
      const preview = createMockPreview({
        languageId: 'typescript',
        useSucraseTranspiler: true,
      });

      await transformEntry('const x: number = 1;', '/path/to/file.ts', preview);

      expect(tsTranspileModule).not.toHaveBeenCalled();
    });

    it('resolves TypeScript config if not already set', async () => {
      const preview = createMockPreview({
        languageId: 'typescript',
        typescriptConfiguration: undefined,
      });

      await transformEntry('const x: number = 1;', '/path/to/file.ts', preview);

      expect(resolveTypescriptConfig).toHaveBeenCalledWith(null);
    });

    it('uses cached TypeScript config if available', async () => {
      const preview = createMockPreview({
        languageId: 'typescript',
        typescriptConfiguration: { tsCompilerOptions: {} },
      });

      await transformEntry('const x: number = 1;', '/path/to/file.ts', preview);

      expect(resolveTypescriptConfig).not.toHaveBeenCalled();
    });

    it('calls transpileWithFallback w/ Sucrase when enabled', async () => {
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

    it('calls transpileWithFallback w/ Babel when Sucrase disabled', async () => {
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
      const preview = createMockPreview({ languageId: 'javascript' });

      const result = await transformEntry(
        'const x = 1;',
        '/path/to/file.js',
        preview
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

    it('skips TypeScript compiler when useSucrase is enabled', async () => {
      mockPreview.configuration.useSucraseTranspiler = true;

      await transform('const x: number = 1;', '/path/to/dep.ts', mockPreview);

      expect(tsTranspileModule).not.toHaveBeenCalled();
    });

    it('prefers Sucrase for node_modules ESM dependencies', async () => {
      // ESM module in node_modules uses Sucrase
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

      // isInNodeModules=true but isModule=false, so !isInNodeModules || isModule(code) = false
      // transpileWithFallback NOT called
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
      // detect node_modules in Windows-style path
      vi.mocked(isModule).mockReturnValue(false);

      // detect node_modules & skip transpilation for CommonJS
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
