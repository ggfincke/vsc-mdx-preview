// tests/extension/fetch/sass-handler.test.ts
// verify Sass uses the document workspace & rewrites compiled CSS references

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { pathToFileURL } from 'url';
import * as vscode from 'vscode';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Preview } from '../../../packages/extension-host/src/features/preview/preview-manager';
import type { ModuleExecutionContext } from '../../../packages/extension-host/src/features/module-runtime/types/handlers';

const { mockCheckFsPathAsync, mockGet, mockUnifiedResolver } = vi.hoisted(
  () => ({
    mockCheckFsPathAsync: vi.fn(),
    mockGet: vi.fn(),
    mockUnifiedResolver: {
      resolveAsync: vi.fn(),
    },
  })
);

vi.mock(
  '../../../packages/extension-host/src/shared/utils/lazy-import',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('../../../packages/extension-host/src/shared/utils/lazy-import')
      >();
    return {
      ...actual,
      createKeyedLazyImport: () => ({
        get: mockGet,
        clear: vi.fn(),
      }),
      loadModuleWithEsmFallback: vi.fn(),
    };
  }
);

vi.mock(
  '../../../packages/extension-host/src/features/module-runtime/resolution/resolver-factory',
  () => ({
    getBrowserResolver: () => ({
      resolveSync: vi.fn(() => undefined),
    }),
  })
);

vi.mock(
  '../../../packages/extension-host/src/features/module-runtime/resolution/UnifiedResolver',
  () => ({
    getUnifiedResolver: () => mockUnifiedResolver,
  })
);

vi.mock(
  '../../../packages/extension-host/src/features/module-runtime/security/checkFsPath',
  () => ({
    checkFsPathAsync: mockCheckFsPathAsync,
  })
);

import { SassHandler } from '../../../packages/extension-host/src/features/module-runtime/handlers/SassHandler';
import { fetchLocal } from '../../../packages/extension-host/src/features/module-runtime/fetch/fetchLocal';

describe('SassHandler module runtime integration', () => {
  afterEach(() => {
    vscode.workspace.workspaceFolders.length = 0;
    vscode.workspace.textDocuments.length = 0;
  });

  it('loads Sass from the document workspace & rewrites compiled url()', async () => {
    const workspaceRoot = path.join('/workspace', 'project');
    vscode.workspace.workspaceFolders.push({
      uri: vscode.Uri.file(workspaceRoot),
    });
    const fsPath = path.join(workspaceRoot, 'styles', 'main.scss');
    mockGet.mockResolvedValue({
      compileStringAsync: vi.fn().mockResolvedValue({
        css: ".hero { background: url('../images/hero.png'); }",
        loadedUrls: [pathToFileURL(fsPath)],
      }),
    });
    const context: ModuleExecutionContext = {
      documentUri: vscode.Uri.file(
        path.join(workspaceRoot, 'docs', 'entry.mdx')
      ),
      entryFsDirectory: path.join(workspaceRoot, 'docs'),
      useSucraseTranspiler: false,
      getWebviewUri: (resourcePath: string) => `webview:${resourcePath}`,
    };

    const result = await new SassHandler().handle('', fsPath, context);

    expect(mockGet).toHaveBeenCalledWith(workspaceRoot);
    expect(result.css).toContain(
      `url('webview:${path.join(workspaceRoot, 'images', 'hero.png')}')`
    );
  });

  it('keeps nested Sass watch metadata on the extension host', async () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'mdx-preview-sass-fetch-')
    );
    try {
      const entryPath = path.join(tempDir, 'entry.mdx');
      const fsPath = path.join(tempDir, 'styles', 'main.scss');
      const partialPath = path.join(tempDir, 'styles', '_theme.scss');
      const nestedPath = path.join(tempDir, 'styles', 'tokens', '_tone.scss');
      const liveSource = '@use "theme"; .live { color: theme.$tone; }';
      fs.mkdirSync(path.dirname(nestedPath), { recursive: true });
      fs.writeFileSync(fsPath, '.disk { color: red; }');
      fs.writeFileSync(partialPath, '@use "tokens/tone"; $tone: tone.$tone;');
      fs.writeFileSync(nestedPath, '$tone: rebeccapurple;');
      vscode.workspace.textDocuments.push({
        uri: vscode.Uri.file(fsPath),
        getText: () => liveSource,
      });
      mockCheckFsPathAsync.mockResolvedValue(true);
      mockUnifiedResolver.resolveAsync.mockResolvedValue({
        fsPath,
        isBuiltInShim: false,
      });
      mockGet.mockResolvedValue(await import('sass'));
      const dependentFsPaths = new Set<string>();
      const preview = {
        entryFsDirectory: tempDir,
        dependentFsPaths,
        dependencyGeneration: 1,
        commitModuleDependencySnapshot: vi.fn(
          (ownerFsPath, _dependencies, watchFiles) => {
            dependentFsPaths.add(ownerFsPath);
            for (const watchFile of watchFiles ?? []) {
              dependentFsPaths.add(watchFile);
            }
          }
        ),
        typescriptConfiguration: undefined,
        configuration: {
          updateMode: 'onType',
          useSucraseTranspiler: false,
        },
        doc: { uri: vscode.Uri.file(entryPath) },
        getWebviewUri: () => undefined,
        webviewHandle: {},
      } as Preview;

      const result = await fetchLocal(
        './styles/main.scss',
        false,
        entryPath,
        preview
      );

      expect(result?.css).toContain('.live');
      expect(result?.css).toContain('color: rebeccapurple;');
      expect(result?.css).not.toContain('.disk');
      expect(result?.dependencies).toEqual([]);
      expect(result).not.toHaveProperty('watchFiles');
      expect(preview.dependentFsPaths).toEqual(
        new Set([fsPath, partialPath, nestedPath])
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
