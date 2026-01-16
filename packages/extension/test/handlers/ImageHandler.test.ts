// packages/extension/test/handlers/ImageHandler.test.ts
// tests for ImageHandler - converts image paths to webview URIs

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImageHandler } from '../../module-fetcher/handlers/ImageHandler';
import { ModuleFetchError } from '../../errors';
import type { Preview } from '../../preview/preview-manager';

describe('ImageHandler', () => {
  const handler = new ImageHandler();
  let mockPreview: Preview;

  beforeEach(() => {
    mockPreview = {
      getWebviewUri: vi.fn(),
    } as unknown as Preview;
  });

  describe('extensions', () => {
    it('handles .gif files', () => {
      expect(handler.extensions).toContain('.gif');
    });

    it('handles .png files', () => {
      expect(handler.extensions).toContain('.png');
    });

    it('handles .jpg files', () => {
      expect(handler.extensions).toContain('.jpg');
    });

    it('handles .jpeg files', () => {
      expect(handler.extensions).toContain('.jpeg');
    });

    it('handles .svg files', () => {
      expect(handler.extensions).toContain('.svg');
    });

    it('handles exactly 5 image extensions', () => {
      expect(handler.extensions).toHaveLength(5);
    });
  });

  describe('handle', () => {
    it('calls preview.getWebviewUri with fsPath', async () => {
      const fsPath = '/workspace/images/logo.png';
      vi.mocked(mockPreview.getWebviewUri).mockReturnValue(
        'https://webview-uri/logo.png'
      );

      await handler.handle('', fsPath, mockPreview);

      expect(mockPreview.getWebviewUri).toHaveBeenCalledWith(fsPath);
    });

    it('wraps webview URI in module.exports', async () => {
      const webviewUri =
        'https://file+.vscode-resource.vscode-cdn.net/path/to/image.png';
      vi.mocked(mockPreview.getWebviewUri).mockReturnValue(webviewUri);

      const result = await handler.handle(
        '',
        '/path/to/image.png',
        mockPreview
      );

      expect(result.code).toBe(`module.exports = "${webviewUri}"`);
    });

    it('throws ModuleFetchError when URI is undefined', async () => {
      vi.mocked(mockPreview.getWebviewUri).mockReturnValue(undefined);

      await expect(
        handler.handle('', '/path/to/image.png', mockPreview)
      ).rejects.toThrow(ModuleFetchError);
    });

    it('error message includes fsPath', async () => {
      vi.mocked(mockPreview.getWebviewUri).mockReturnValue(undefined);
      const fsPath = '/workspace/assets/missing.svg';

      await expect(handler.handle('', fsPath, mockPreview)).rejects.toThrow(
        fsPath
      );
    });

    it('error message mentions webview not initialized', async () => {
      vi.mocked(mockPreview.getWebviewUri).mockReturnValue(undefined);

      await expect(
        handler.handle('', '/path/to/image.png', mockPreview)
      ).rejects.toThrow('Preview webview not initialized');
    });

    it('error has TRANSFORM_ERROR code', async () => {
      vi.mocked(mockPreview.getWebviewUri).mockReturnValue(undefined);

      try {
        await handler.handle('', '/path/to/image.png', mockPreview);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ModuleFetchError);
        expect((error as ModuleFetchError).code).toBe('TRANSFORM_ERROR');
      }
    });

    it('preserves fsPath in result', async () => {
      const fsPath = '/workspace/images/icon.gif';
      vi.mocked(mockPreview.getWebviewUri).mockReturnValue('https://uri');

      const result = await handler.handle('', fsPath, mockPreview);

      expect(result.fsPath).toBe(fsPath);
    });

    it('returns empty dependencies array', async () => {
      vi.mocked(mockPreview.getWebviewUri).mockReturnValue('https://uri');

      const result = await handler.handle(
        '',
        '/path/to/image.jpg',
        mockPreview
      );

      expect(result.dependencies).toEqual([]);
    });

    it('does not use code parameter', async () => {
      vi.mocked(mockPreview.getWebviewUri).mockReturnValue('https://uri');
      const fsPath = '/path/to/image.jpeg';

      // Pass arbitrary code - it should be ignored
      const result = await handler.handle(
        'some random content',
        fsPath,
        mockPreview
      );

      expect(mockPreview.getWebviewUri).toHaveBeenCalledWith(fsPath);
      expect(result.code).toContain('module.exports');
    });

    it('handles paths with special characters', async () => {
      const fsPath = '/workspace/images/my file (1).png';
      const webviewUri = 'https://encoded-uri/my%20file%20(1).png';
      vi.mocked(mockPreview.getWebviewUri).mockReturnValue(webviewUri);

      const result = await handler.handle('', fsPath, mockPreview);

      expect(result.code).toContain(webviewUri);
    });

    it('handles Windows-style paths', async () => {
      const fsPath = 'C:\\Users\\test\\images\\logo.png';
      const webviewUri = 'https://webview-uri/logo.png';
      vi.mocked(mockPreview.getWebviewUri).mockReturnValue(webviewUri);

      const result = await handler.handle('', fsPath, mockPreview);

      expect(mockPreview.getWebviewUri).toHaveBeenCalledWith(fsPath);
      expect(result.fsPath).toBe(fsPath);
    });
  });
});
