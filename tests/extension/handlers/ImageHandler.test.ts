// tests/extension/handlers/ImageHandler.test.ts
// unit tests for image file handler

import { describe, it, expect } from 'vitest';
import { ImageHandler } from '../../../packages/extension-host/src/features/module-runtime/handlers/ImageHandler';
import type { ModuleExecutionContext } from '../../../packages/extension-host/src/features/module-runtime/types/handlers';

function createContext(uri: string | undefined): ModuleExecutionContext {
  return {
    getWebviewUri: () => uri,
  } as ModuleExecutionContext;
}

describe('ImageHandler', () => {
  const handler = new ImageHandler();

  it('wraps webview URI as module export', async () => {
    const webviewUri = 'vscode-resource:/workspace/assets/logo.png';
    const fsPath = '/workspace/assets/logo.png';
    const context = createContext(webviewUri);

    const result = await handler.handle('', fsPath, context);

    expect(result.code).toBe(`module.exports = "${webviewUri}"`);
    expect(result.dependencies).toEqual([]);
    expect(result.fsPath).toBe(fsPath);
  });

  it('throws when webview URI is unavailable', async () => {
    const context = createContext(undefined);

    await expect(
      handler.handle('', '/workspace/assets/missing.png', context)
    ).rejects.toThrow(/Failed to compile/);
  });
});
