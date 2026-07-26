// tests/extension/fetch/sass-handler.test.ts
// verify Sass uses the document workspace & rewrites compiled CSS references

import * as path from 'path';
import * as vscode from 'vscode';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Preview } from '../../../packages/extension-host/src/features/preview/preview-manager';

const { mockGet } = vi.hoisted(() => ({
  mockGet: vi.fn(),
}));

vi.mock(
  '../../../packages/extension-host/src/shared/utils/lazy-import',
  () => ({
    createKeyedLazyImport: () => ({
      get: mockGet,
      clear: vi.fn(),
    }),
    loadModuleWithEsmFallback: vi.fn(),
  })
);

vi.mock(
  '../../../packages/extension-host/src/features/module-runtime/resolution/resolver-factory',
  () => ({
    getBrowserResolver: () => ({
      resolveSync: vi.fn(() => undefined),
    }),
  })
);

import { SassHandler } from '../../../packages/extension-host/src/features/module-runtime/handlers/SassHandler';

describe('SassHandler module runtime integration', () => {
  afterEach(() => {
    vscode.workspace.workspaceFolders.length = 0;
  });

  it('loads Sass from the document workspace & rewrites compiled url()', async () => {
    const workspaceRoot = path.join('/workspace', 'project');
    vscode.workspace.workspaceFolders.push({
      uri: vscode.Uri.file(workspaceRoot),
    });
    mockGet.mockResolvedValue({
      compileAsync: vi.fn().mockResolvedValue({
        css: ".hero { background: url('../images/hero.png'); }",
      }),
    });
    const fsPath = path.join(workspaceRoot, 'styles', 'main.scss');
    const preview = {
      doc: { uri: vscode.Uri.file(path.join(workspaceRoot, 'docs', 'entry.mdx')) },
      entryFsDirectory: path.join(workspaceRoot, 'docs'),
      getWebviewUri: (resourcePath: string) => `webview:${resourcePath}`,
    } as Preview;

    const result = await new SassHandler().handle('', fsPath, preview);

    expect(mockGet).toHaveBeenCalledWith(workspaceRoot);
    expect(result.css).toContain(
      `url('webview:${path.join(workspaceRoot, 'images', 'hero.png')}')`
    );
  });
});
