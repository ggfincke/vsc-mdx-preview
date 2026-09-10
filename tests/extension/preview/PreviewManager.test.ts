// tests/extension/preview/PreviewManager.test.ts
// unit tests for preview manager singleton lifecycle & state

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  SETTINGS_DEFAULTS,
  type ModuleDependency,
} from '@mdx-preview/contracts';

import {
  mockConfigManager,
  mockPreviewManager,
} from '../../helpers/mock-services';

const previewModuleMocks = vi.hoisted(() => ({
  createOrShowPanel: vi.fn(),
  ensureWebviewResourcesReady: vi.fn(async () => {}),
  refreshPanel: vi.fn(),
  showSafeModeNotificationIfNeeded: vi.fn(async () => {}),
  evaluateInWebview: vi.fn(),
}));

vi.mock(
  '../../../packages/extension-host/src/features/preview/evaluate-in-webview',
  () => ({ default: previewModuleMocks.evaluateInWebview })
);

vi.mock(
  '../../../packages/extension-host/src/shared/utils/find-up',
  async (importOriginal) => ({
    ...(await importOriginal()),
    createWorkspaceStopPredicate: () => (dir: string) =>
      vscode.workspace.workspaceFolders?.some(
        ({ uri }) => uri.fsPath === dir
      ) ?? false,
  })
);

vi.mock(
  '../../../packages/extension-host/src/features/preview/webview-manager',
  () => ({
    createOrShowPanel: previewModuleMocks.createOrShowPanel,
    ensureWebviewResourcesReady: previewModuleMocks.ensureWebviewResourcesReady,
    refreshPanel: previewModuleMocks.refreshPanel,
  })
);

vi.mock(
  '../../../packages/extension-host/src/features/preview/Preview',
  () => ({
    Preview: vi.fn(),
  })
);

vi.mock(
  '../../../packages/extension-host/src/features/preview/safe-mode-notification',
  () => ({
    showSafeModeNotificationIfNeeded:
      previewModuleMocks.showSafeModeNotificationIfNeeded,
  })
);

import { PreviewManager } from '../../../packages/extension-host/src/features/preview/preview-manager';
import { Preview } from '../../../packages/extension-host/src/features/preview/Preview';
import { openPreview } from '../../../packages/extension-host/src/features/preview/preview-commands';
import {
  ensureWebviewResourcesReady,
  initWebviewAppHTMLResources,
  initWebviewAppHTMLResourcesAsync,
} from '../../../packages/extension-host/src/features/preview/webview-resources';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createMockPreview(): Preview {
  return {
    dispose: vi.fn(),
  } as unknown as Preview;
}

describe('PreviewManager', () => {
  beforeEach(() => {
    PreviewManager.reset();
    vi.clearAllMocks();
    vi.mocked(Preview).mockReset();
    previewModuleMocks.createOrShowPanel.mockReset();
    previewModuleMocks.ensureWebviewResourcesReady.mockReset();
    previewModuleMocks.ensureWebviewResourcesReady.mockResolvedValue();
    mockPreviewManager.getCurrentPreview.mockReset();
    mockPreviewManager.setCurrentPreview.mockReset();
    mockPreviewManager.getPanel.mockReset();
    mockPreviewManager.clearPanel.mockReset();
    mockPreviewManager.setExtensionUri.mockReset();
    mockPreviewManager.setWebviewAppUris.mockReset();
    vscode.window.activeTextEditor = undefined;
  });

  describe('dispose', () => {
    it('clears panel, disposes current preview, clears reference', () => {
      const mgr = PreviewManager.getInstance();
      const panel = { dispose: vi.fn() } as any;
      const preview = createMockPreview();
      mgr.setPanel(panel);
      mgr.setCurrentPreview(preview);

      mgr.dispose();
      expect(panel.dispose).toHaveBeenCalled();
      expect(preview.dispose).toHaveBeenCalled();
    });
  });

  it('retries resource initialization while deduplicating each attempt', async () => {
    const uriType = vscode.Uri as typeof vscode.Uri & {
      joinPath(base: vscode.Uri, ...paths: string[]): vscode.Uri;
    };
    const originalJoinPath = Object.getOwnPropertyDescriptor(
      uriType,
      'joinPath'
    );
    Object.defineProperty(uriType, 'joinPath', {
      configurable: true,
      value: (base: vscode.Uri, ...paths: string[]) =>
        vscode.Uri.file([base.fsPath, ...paths].join('/')),
    });

    const firstRead = createDeferred<Uint8Array>();
    const manifest = new TextEncoder().encode(
      JSON.stringify({
        'index.html': {
          file: 'assets/main.js',
          css: ['assets/main.css'],
        },
      })
    );
    const readFile = vi
      .spyOn(vscode.workspace.fs, 'readFile')
      .mockImplementationOnce(() => firstRead.promise)
      .mockResolvedValueOnce(new TextEncoder().encode('{}'))
      .mockResolvedValueOnce(new TextEncoder().encode('{}'))
      .mockResolvedValueOnce(manifest);
    vi.spyOn(vscode.workspace.fs, 'stat').mockResolvedValue(
      {} as vscode.FileStat
    );

    const context = {
      extensionUri: vscode.Uri.file('/extension'),
    } as vscode.ExtensionContext;
    const transientError = new Error('temporary read failure');

    try {
      initWebviewAppHTMLResourcesAsync(context);
      const concurrentReady = [
        ensureWebviewResourcesReady(),
        ensureWebviewResourcesReady(),
      ];
      expect(concurrentReady[0]).toBe(concurrentReady[1]);
      expect(readFile).toHaveBeenCalledTimes(1);

      const concurrentAssertions = concurrentReady.map((promise) =>
        expect(promise).rejects.toBe(transientError)
      );
      firstRead.reject(transientError);
      await Promise.all(concurrentAssertions);

      await expect(ensureWebviewResourcesReady()).rejects.toMatchObject({
        code: 'E600',
      });
      await expect(ensureWebviewResourcesReady()).rejects.toMatchObject({
        code: 'E600',
      });
      expect(readFile).toHaveBeenCalledTimes(3);

      await initWebviewAppHTMLResources(context);
      await ensureWebviewResourcesReady();
      expect(readFile).toHaveBeenCalledTimes(4);
      expect(mockPreviewManager.setWebviewAppUris).toHaveBeenCalledWith(
        expect.objectContaining({
          mainScript: expect.objectContaining({
            fsPath: '/extension/build/webview-app/assets/main.js',
          }),
        })
      );
    } finally {
      if (originalJoinPath) {
        Object.defineProperty(uriType, 'joinPath', originalJoinPath);
      } else {
        Reflect.deleteProperty(uriType, 'joinPath');
      }
    }
  });

  it('avoids preview ownership changes when resource initialization fails', async () => {
    const doc = {
      uri: vscode.Uri.file('/workspace/next.mdx'),
      fileName: '/workspace/next.mdx',
      getText: () => '# Next',
      languageId: 'mdx',
    } as vscode.TextDocument;
    const preview = {
      dispose: vi.fn(),
      setDoc: vi.fn(),
      updateWebview: vi.fn(async () => {}),
    } as unknown as Preview;
    const resourceError = new Error('resource initialization failed');

    mockPreviewManager.getCurrentPreview.mockReturnValue(preview);
    previewModuleMocks.ensureWebviewResourcesReady.mockRejectedValue(
      resourceError
    );
    vscode.window.activeTextEditor = { document: doc } as vscode.TextEditor;

    await expect(openPreview()).rejects.toBe(resourceError);

    expect(preview.setDoc).not.toHaveBeenCalled();
    expect(preview.dispose).not.toHaveBeenCalled();
    expect(mockPreviewManager.getCurrentPreview).not.toHaveBeenCalled();
    expect(previewModuleMocks.createOrShowPanel).not.toHaveBeenCalled();
    expect(mockPreviewManager.clearPanel).not.toHaveBeenCalled();
    expect(mockPreviewManager.setCurrentPreview).not.toHaveBeenCalled();

    mockPreviewManager.getCurrentPreview.mockReturnValue(undefined);
    await expect(openPreview()).rejects.toBe(resourceError);

    expect(Preview).not.toHaveBeenCalled();
    expect(mockPreviewManager.setCurrentPreview).not.toHaveBeenCalled();
  });

  it('refreshes unsaved imports and retains their ownership when reopening', async () => {
    const { Preview: ActualPreview } = await vi.importActual<
      typeof import('../../../packages/extension-host/src/features/preview/Preview')
    >('../../../packages/extension-host/src/features/preview/Preview');
    const root = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'mdx-preview-refresh-'))
    );
    const entryPath = path.join(root, 'entry.mdx');
    const widgetPath = path.join(root, 'Widget.tsx');
    const childPath = path.join(root, 'Child.tsx');
    const entryText = 'import Widget from "./Widget.tsx"\n\n<Widget />';
    fs.writeFileSync(entryPath, entryText);
    fs.writeFileSync(widgetPath, 'export default function Widget() {}');
    fs.writeFileSync(childPath, 'export default function Child() {}');
    let widgetText = 'widget saved';
    let childText = 'child saved';
    const doc = {
      uri: vscode.Uri.file(entryPath),
      version: 1,
      languageId: 'mdx',
      getText: () => entryText,
    } as vscode.TextDocument;
    const widget = {
      uri: vscode.Uri.file(widgetPath),
      getText: () => widgetText,
    } as vscode.TextDocument;
    const child = {
      uri: vscode.Uri.file(childPath),
      getText: () => childText,
    } as vscode.TextDocument;
    const dependency = (specifier: string): ModuleDependency => ({
      specifier,
      runtimeRequest: specifier,
      kind: 'import',
    });
    const priorFolders = vscode.workspace.workspaceFolders;
    vscode.workspace.workspaceFolders = [
      { uri: vscode.Uri.file(root), name: 'fixture', index: 0 },
    ];
    mockConfigManager.getAll.mockReturnValue({
      ...SETTINGS_DEFAULTS,
      'preview.debounceDelay': 1,
    });
    const rendered: string[] = [];
    const stale = vi.fn();
    let preview: Preview | undefined;
    try {
      preview = new ActualPreview(doc);
      preview.active = true;
      preview.setWebviewHandle({
        invalidate: vi.fn(async () => {}),
        setStale: stale,
      } as never);
      preview.completeHandshake(preview.getWebviewHandshakeId());
      previewModuleMocks.evaluateInWebview.mockImplementation(
        async (current: Preview, text: string) => {
          expect(text).toBe(entryText);
          current.updateDependencies([dependency('./Widget.tsx')]);
          current.commitModuleDependencySnapshot(
            widgetPath,
            [dependency('./Child.tsx')],
            undefined,
            current.dependencyGeneration
          );
          rendered.push(`${widget.getText()} / ${child.getText()}`);
        }
      );
      mockPreviewManager.getCurrentPreview.mockReturnValue(preview);
      vscode.window.activeTextEditor = { document: doc } as vscode.TextEditor;
      await openPreview();

      widgetText = 'widget unsaved';
      await preview.handleDidChangeTextDocument(widgetPath, widget);
      await vi.waitFor(() => expect(rendered).toHaveLength(2));
      expect(stale).toHaveBeenLastCalledWith(false);

      const reopenedDoc = { ...doc } as vscode.TextDocument;
      vscode.window.activeTextEditor = {
        document: reopenedDoc,
      } as vscode.TextEditor;
      await openPreview();
      expect(preview.doc).toBe(reopenedDoc);
      expect(rendered).toHaveLength(2);
      expect(preview.dependentFsPaths).toEqual(
        new Set([entryPath, widgetPath, childPath])
      );

      childText = 'child unsaved';
      await preview.handleDidChangeTextDocument(childPath, child);
      await vi.waitFor(() =>
        expect(rendered).toEqual([
          'widget saved / child saved',
          'widget unsaved / child saved',
          'widget unsaved / child unsaved',
        ])
      );
      expect(stale).toHaveBeenLastCalledWith(false);
      expect(preview.dependentFsPaths).toEqual(
        new Set([entryPath, widgetPath, childPath])
      );
      await preview.updateWebview();
      expect(rendered).toHaveLength(3);
    } finally {
      preview?.dispose();
      vscode.workspace.workspaceFolders = priorFolders;
      mockConfigManager.getAll.mockReturnValue({});
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
