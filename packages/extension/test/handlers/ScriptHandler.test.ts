// packages/extension/test/handlers/ScriptHandler.test.ts
// tests for ScriptHandler - transpiles JS/TS files and extracts dependencies

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Preview } from '../../preview/preview-manager';

// stub transform & extractImports before importing ScriptHandler
vi.mock('../../module-fetcher/transform', () => ({
  transform: vi.fn(),
}));

vi.mock('../../module-fetcher/import-extractor', () => ({
  extractImports: vi.fn(),
}));

import { ScriptHandler } from '../../module-fetcher/handlers/ScriptHandler';
import { transform } from '../../module-fetcher/transform';
import { extractImports } from '../../module-fetcher/import-extractor';

describe('ScriptHandler', () => {
  const handler = new ScriptHandler();
  const mockPreview = {} as Preview;

  beforeEach(() => {
    vi.clearAllMocks();
    // configure default mocks
    vi.mocked(transform).mockResolvedValue('transformed code');
    vi.mocked(extractImports).mockResolvedValue([]);
  });

  describe('extensions', () => {
    it('handles .js files', () => {
      expect(handler.extensions).toContain('.js');
    });

    it('handles .jsx files', () => {
      expect(handler.extensions).toContain('.jsx');
    });

    it('handles .ts files', () => {
      expect(handler.extensions).toContain('.ts');
    });

    it('handles .tsx files', () => {
      expect(handler.extensions).toContain('.tsx');
    });

    it('handles .mjs files', () => {
      expect(handler.extensions).toContain('.mjs');
    });

    it('handles .cjs files', () => {
      expect(handler.extensions).toContain('.cjs');
    });

    it('handles .mdx files', () => {
      expect(handler.extensions).toContain('.mdx');
    });

    it('handles .md files', () => {
      expect(handler.extensions).toContain('.md');
    });

    it('handles exactly 8 extensions', () => {
      expect(handler.extensions).toHaveLength(8);
    });
  });

  describe('handle', () => {
    it('calls transform with code, fsPath, and preview', async () => {
      const code = 'const x = 1;';
      const fsPath = '/path/to/file.ts';

      await handler.handle(code, fsPath, mockPreview);

      expect(transform).toHaveBeenCalledWith(code, fsPath, mockPreview);
    });

    it('calls extractImports on transformed code', async () => {
      const transformedCode = 'var x = 1;';
      vi.mocked(transform).mockResolvedValue(transformedCode);

      await handler.handle('const x = 1;', '/path/to/file.ts', mockPreview);

      expect(extractImports).toHaveBeenCalledWith(transformedCode);
    });

    it('returns transformed code in result', async () => {
      const transformedCode = 'var _jsx = require("react/jsx-runtime");';
      vi.mocked(transform).mockResolvedValue(transformedCode);

      const result = await handler.handle('', '/path/to/file.tsx', mockPreview);

      expect(result.code).toBe(transformedCode);
    });

    it('returns extracted dependencies in result', async () => {
      const deps = ['react', './utils', 'lodash'];
      vi.mocked(extractImports).mockResolvedValue(deps);

      const result = await handler.handle('', '/path/to/file.js', mockPreview);

      expect(result.dependencies).toEqual(deps);
    });

    it('filters undefined from dependencies', async () => {
      vi.mocked(extractImports).mockResolvedValue([
        'react',
        undefined as any,
        './utils',
      ]);

      const result = await handler.handle('', '/path/to/file.js', mockPreview);

      expect(result.dependencies).toEqual(['react', './utils']);
    });

    it('filters null from dependencies', async () => {
      vi.mocked(extractImports).mockResolvedValue([
        'react',
        null as any,
        './utils',
      ]);

      const result = await handler.handle('', '/path/to/file.js', mockPreview);

      expect(result.dependencies).toEqual(['react', './utils']);
    });

    it('preserves fsPath in result', async () => {
      const fsPath = '/workspace/src/components/Button.tsx';

      const result = await handler.handle('', fsPath, mockPreview);

      expect(result.fsPath).toBe(fsPath);
    });

    it('does not include css field in result', async () => {
      const result = await handler.handle('', '/path/to/file.js', mockPreview);

      expect(result.css).toBeUndefined();
    });

    it('handles TypeScript code', async () => {
      const tsCode = 'const x: number = 1;';
      const transformedCode = 'var x = 1;';
      vi.mocked(transform).mockResolvedValue(transformedCode);

      const result = await handler.handle(
        tsCode,
        '/path/to/file.ts',
        mockPreview
      );

      expect(transform).toHaveBeenCalledWith(
        tsCode,
        '/path/to/file.ts',
        mockPreview
      );
      expect(result.code).toBe(transformedCode);
    });

    it('handles JSX code', async () => {
      const jsxCode = 'const App = () => <div>Hello</div>;';
      const transformedCode =
        'var App = function() { return _jsx("div", { children: "Hello" }); };';
      vi.mocked(transform).mockResolvedValue(transformedCode);

      const result = await handler.handle(
        jsxCode,
        '/path/to/file.jsx',
        mockPreview
      );

      expect(result.code).toBe(transformedCode);
    });

    it('handles MDX code', async () => {
      const mdxCode = '# Hello\n\n<Component />';
      const transformedCode =
        'function MDXContent() { return _jsx("h1", ...); }';
      vi.mocked(transform).mockResolvedValue(transformedCode);

      await handler.handle(mdxCode, '/path/to/doc.mdx', mockPreview);

      expect(transform).toHaveBeenCalledWith(
        mdxCode,
        '/path/to/doc.mdx',
        mockPreview
      );
    });

    it('propagates transform errors', async () => {
      const transformError = new Error('Transform failed: syntax error');
      vi.mocked(transform).mockRejectedValue(transformError);

      await expect(
        handler.handle('invalid syntax', '/path/to/file.ts', mockPreview)
      ).rejects.toThrow('Transform failed');
    });

    it('propagates extractImports errors', async () => {
      const extractError = new Error('Failed to parse imports');
      vi.mocked(extractImports).mockRejectedValue(extractError);

      await expect(
        handler.handle('const x = 1;', '/path/to/file.ts', mockPreview)
      ).rejects.toThrow('Failed to parse imports');
    });

    it('handles empty code', async () => {
      vi.mocked(transform).mockResolvedValue('');
      vi.mocked(extractImports).mockResolvedValue([]);

      const result = await handler.handle('', '/path/to/empty.js', mockPreview);

      expect(result.code).toBe('');
      expect(result.dependencies).toEqual([]);
    });

    it('handles code with multiple imports', async () => {
      const deps = [
        'react',
        'react-dom',
        './Button',
        '../utils/helper',
        'lodash/get',
      ];
      vi.mocked(extractImports).mockResolvedValue(deps);

      const result = await handler.handle('', '/path/to/file.tsx', mockPreview);

      expect(result.dependencies).toEqual(deps);
      expect(result.dependencies).toHaveLength(5);
    });
  });
});
