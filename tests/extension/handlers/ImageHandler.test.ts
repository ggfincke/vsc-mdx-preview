// tests/extension/handlers/ImageHandler.test.ts
// unit tests for image file handler

import { describe, it, expect } from 'vitest';
import { ImageHandler } from '../../../packages/extension-host/src/features/module-runtime/handlers/ImageHandler';
import type { Preview } from '../../../packages/extension-host/src/features/preview/preview-manager';

function createPreview(uri: string | undefined): Preview {
  return {
    getWebviewUri: () => uri,
  } as Preview;
}

describe('ImageHandler', () => {
  const handler = new ImageHandler();

  it('should handle common image extensions', () => {
    expect(handler.extensions).toEqual(
      expect.arrayContaining(['.png', '.jpg', '.jpeg', '.gif', '.svg'])
    );
  });

  it('wraps webview URI as module export', async () => {
    const webviewUri = 'vscode-resource:/workspace/assets/logo.png';
    const fsPath = '/workspace/assets/logo.png';
    const preview = createPreview(webviewUri);

    const result = await handler.handle('', fsPath, preview);

    expect(result.code).toBe(`module.exports = "${webviewUri}"`);
    expect(result.dependencies).toEqual([]);
    expect(result.fsPath).toBe(fsPath);
  });

  it('throws when webview URI is unavailable', async () => {
    const preview = createPreview(undefined);

    await expect(
      handler.handle('', '/workspace/assets/missing.png', preview)
    ).rejects.toThrow(/Failed to compile/);
  });
});
