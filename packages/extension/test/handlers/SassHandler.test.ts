// packages/extension/test/handlers/SassHandler.test.ts
// tests for SassHandler - compiles SASS/SCSS to CSS

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Preview } from '../../preview/preview-manager';

// mock sass module before importing SassHandler
vi.mock('sass', () => ({
  compileAsync: vi.fn(),
}));

// mock resolver-factory
vi.mock('../../module-fetcher/resolver-factory', () => ({
  getBrowserResolver: vi.fn(() => ({
    resolveSync: vi.fn(),
  })),
}));

import { SassHandler } from '../../module-fetcher/handlers/SassHandler';
import * as sass from 'sass';
import { getBrowserResolver } from '../../module-fetcher/resolver-factory';

describe('SassHandler', () => {
  const handler = new SassHandler();
  const mockPreview = {} as Preview;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extensions', () => {
    it('handles .scss files', () => {
      expect(handler.extensions).toContain('.scss');
    });

    it('handles .sass files', () => {
      expect(handler.extensions).toContain('.sass');
    });

    it('handles exactly 2 extensions', () => {
      expect(handler.extensions).toHaveLength(2);
    });
  });

  describe('handle', () => {
    it('calls sass.compileAsync with fsPath', async () => {
      const fsPath = '/workspace/styles/main.scss';
      vi.mocked(sass.compileAsync).mockResolvedValue({
        css: '.test {}',
      } as any);

      await handler.handle('$color: red;', fsPath, mockPreview);

      expect(sass.compileAsync).toHaveBeenCalledWith(
        fsPath,
        expect.objectContaining({
          importers: expect.any(Array),
        })
      );
    });

    it('returns compiled CSS in css field', async () => {
      const compiledCss = '.button { color: red; }';
      vi.mocked(sass.compileAsync).mockResolvedValue({
        css: compiledCss,
      } as any);

      const result = await handler.handle(
        '',
        '/path/to/styles.scss',
        mockPreview
      );

      expect(result.css).toBe(compiledCss);
    });

    it('returns empty string for code field', async () => {
      vi.mocked(sass.compileAsync).mockResolvedValue({
        css: '.test {}',
      } as any);

      const result = await handler.handle(
        '',
        '/path/to/styles.scss',
        mockPreview
      );

      expect(result.code).toBe('');
    });

    it('returns empty dependencies array', async () => {
      vi.mocked(sass.compileAsync).mockResolvedValue({
        css: '.test {}',
      } as any);

      const result = await handler.handle(
        '',
        '/path/to/styles.scss',
        mockPreview
      );

      expect(result.dependencies).toEqual([]);
    });

    it('preserves fsPath in result', async () => {
      vi.mocked(sass.compileAsync).mockResolvedValue({
        css: '.test {}',
      } as any);
      const fsPath = '/workspace/src/components/Button.scss';

      const result = await handler.handle('', fsPath, mockPreview);

      expect(result.fsPath).toBe(fsPath);
    });

    it('uses browser resolver for import resolution', async () => {
      vi.mocked(sass.compileAsync).mockResolvedValue({
        css: '.test {}',
      } as any);

      await handler.handle('', '/path/to/styles.scss', mockPreview);

      expect(getBrowserResolver).toHaveBeenCalled();
    });

    it('configures custom importer for @import resolution', async () => {
      vi.mocked(sass.compileAsync).mockResolvedValue({
        css: '.test {}',
      } as any);

      await handler.handle('', '/path/to/styles.scss', mockPreview);

      const callArgs = vi.mocked(sass.compileAsync).mock.calls[0];
      expect(callArgs[1]).toHaveProperty('importers');
      expect(callArgs[1]!.importers).toHaveLength(1);
      expect(callArgs[1]!.importers![0]).toHaveProperty('findFileUrl');
    });

    it('propagates sass compilation errors', async () => {
      const sassError = new Error('Compilation failed: Invalid syntax');
      vi.mocked(sass.compileAsync).mockRejectedValue(sassError);

      await expect(
        handler.handle('invalid sass', '/path/to/styles.scss', mockPreview)
      ).rejects.toThrow('Compilation failed');
    });

    it('handles complex SCSS output', async () => {
      const complexCss = `
        .container { display: flex; }
        .container .item { flex: 1; }
        @media (max-width: 600px) {
          .container { flex-direction: column; }
        }
      `;
      vi.mocked(sass.compileAsync).mockResolvedValue({
        css: complexCss,
      } as any);

      const result = await handler.handle(
        '',
        '/path/to/complex.scss',
        mockPreview
      );

      expect(result.css).toBe(complexCss);
    });

    describe('custom importer', () => {
      it('resolves imports using browser resolver', async () => {
        const mockResolver = {
          resolveSync: vi.fn().mockReturnValue('/resolved/path.scss'),
        };
        vi.mocked(getBrowserResolver).mockReturnValue(mockResolver as any);

        // Capture the importer to test it
        let capturedImporter: any;
        vi.mocked(sass.compileAsync).mockImplementation(
          async (_fsPath, options) => {
            capturedImporter = options?.importers?.[0];
            return { css: '.test {}' } as any;
          }
        );

        await handler.handle('', '/project/styles/main.scss', mockPreview);

        // Test the findFileUrl function
        const result = capturedImporter.findFileUrl('_variables');

        expect(mockResolver.resolveSync).toHaveBeenCalledWith(
          {},
          '/project/styles',
          '_variables'
        );
        expect(result).toEqual(new URL('file:///resolved/path.scss'));
      });

      it('returns null when import cannot be resolved', async () => {
        const mockResolver = {
          resolveSync: vi.fn().mockReturnValue(false),
        };
        vi.mocked(getBrowserResolver).mockReturnValue(mockResolver as any);

        let capturedImporter: any;
        vi.mocked(sass.compileAsync).mockImplementation(
          async (_fsPath, options) => {
            capturedImporter = options?.importers?.[0];
            return { css: '.test {}' } as any;
          }
        );

        await handler.handle('', '/project/styles/main.scss', mockPreview);

        const result = capturedImporter.findFileUrl('nonexistent');

        expect(result).toBeNull();
      });

      it('returns null when resolver returns undefined', async () => {
        const mockResolver = {
          resolveSync: vi.fn().mockReturnValue(undefined),
        };
        vi.mocked(getBrowserResolver).mockReturnValue(mockResolver as any);

        let capturedImporter: any;
        vi.mocked(sass.compileAsync).mockImplementation(
          async (_fsPath, options) => {
            capturedImporter = options?.importers?.[0];
            return { css: '.test {}' } as any;
          }
        );

        await handler.handle('', '/project/styles/main.scss', mockPreview);

        const result = capturedImporter.findFileUrl('missing');

        expect(result).toBeNull();
      });
    });
  });
});
