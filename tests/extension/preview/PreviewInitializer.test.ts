// tests/extension/preview/PreviewInitializer.test.ts
// unit tests for preview initialization & watcher orchestration

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { Preview } from '../../../packages/extension-host/src/features/preview/Preview';
import { PreviewInitializer } from '../../../packages/extension-host/src/features/preview/PreviewInitializer';
import { WatcherManager } from '../../../packages/extension-host/src/features/preview/watchers/WatcherManager';
import { WEBVIEW_HANDSHAKE_TIMEOUT_MS } from '../../../packages/extension-host/src/shared/constants';
import {
  mockTailwindProcessor,
  mockConfigManager,
  mockConfigCache,
} from '../../helpers/mock-services';

const {
  configHandlers,
  configCandidateDisposables,
  mockGetConfigCandidatePaths,
  mockWatchConfigCandidates,
  mockWatchTypeScriptConfig,
  typescriptConfigDisposables,
  typescriptConfigHandlers,
} = vi.hoisted(() => ({
  configHandlers: [] as Array<(event: { configPath: string }) => void>,
  configCandidateDisposables: [] as Array<{
    dispose: ReturnType<typeof vi.fn>;
  }>,
  mockGetConfigCandidatePaths: vi.fn(),
  mockWatchConfigCandidates: vi.fn(() => {
    const disposable = { dispose: vi.fn() };
    configCandidateDisposables.push(disposable);
    return disposable;
  }),
  mockWatchTypeScriptConfig: vi.fn(
    (_documentPath: string, handler: (configPath: string) => void) => {
      const disposable = { dispose: vi.fn() };
      typescriptConfigDisposables.push(disposable);
      typescriptConfigHandlers.push(handler);
      return disposable;
    }
  ),
  typescriptConfigDisposables: [] as Array<{
    dispose: ReturnType<typeof vi.fn>;
  }>,
  typescriptConfigHandlers: [] as Array<(configPath: string) => void>,
}));

vi.mock(
  '../../../packages/extension-host/src/features/preview/configuration/ConfigResolver',
  () => ({
    getConfigCandidatePaths: mockGetConfigCandidatePaths,
    watchConfigCandidates: mockWatchConfigCandidates,
    onConfigChange: (handler: (event: { configPath: string }) => void) => {
      configHandlers.push(handler);
      return { dispose: vi.fn() };
    },
  })
);

vi.mock(
  '../../../packages/extension-host/src/features/preview/configuration/TypeScriptConfigResolver',
  () => ({
    watchTypeScriptConfig: mockWatchTypeScriptConfig,
  })
);

describe('PreviewInitializer', () => {
  beforeEach(() => {
    configHandlers.length = 0;
    configCandidateDisposables.length = 0;
    typescriptConfigDisposables.length = 0;
    typescriptConfigHandlers.length = 0;
    mockGetConfigCandidatePaths.mockReturnValue([
      '/workspace/.mdx-previewrc.json',
      '/workspace/.mdx-previewrc',
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('settles handshake generations, replaces ready gates, & times out', async () => {
    vi.useFakeTimers();
    const initializer = new PreviewInitializer();
    const first = initializer.createHandshake();
    const second = initializer.createHandshake();
    let secondSettled = false;
    void second.promise.then(() => {
      secondSettled = true;
    });

    await expect(first.promise).resolves.toBeUndefined();
    expect(secondSettled).toBe(false);

    second.resolve();
    await expect(second.promise).resolves.toBeUndefined();
    vi.advanceTimersByTime(WEBVIEW_HANDSHAKE_TIMEOUT_MS + 1);
    expect(initializer.consumeHandshakeTimeout()).toBe(false);

    const watcherManager = new WatcherManager();
    let resolveFirstGate!: () => void;
    let resolveSecondGate!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      resolveFirstGate = resolve;
    });
    const secondGate = new Promise<void>((resolve) => {
      resolveSecondGate = resolve;
    });
    watcherManager.setReadyGate(firstGate);
    let gateCompleted = false;
    const waiting = watcherManager.waitForGate().then(() => {
      gateCompleted = true;
    });

    watcherManager.setReadyGate(secondGate);
    let freshGateCompleted = false;
    const freshWaiting = watcherManager.waitForGate().then(() => {
      freshGateCompleted = true;
    });
    await Promise.resolve();
    expect(gateCompleted).toBe(false);
    expect(freshGateCompleted).toBe(false);

    resolveFirstGate();
    await Promise.resolve();
    expect(gateCompleted).toBe(false);

    resolveSecondGate();
    await Promise.all([waiting, freshWaiting]);
    expect(gateCompleted).toBe(true);
    expect(freshGateCompleted).toBe(true);
    watcherManager.dispose();

    const disposedManager = new WatcherManager();
    disposedManager.setReadyGate(new Promise<void>(() => {}));
    const disposedWaiting = disposedManager.waitForGate();
    disposedManager.dispose();
    await expect(disposedWaiting).resolves.toBeUndefined();
    initializer.dispose();

    const timedInitializer = new PreviewInitializer();
    const { promise } = timedInitializer.createHandshake();

    vi.advanceTimersByTime(WEBVIEW_HANDSHAKE_TIMEOUT_MS + 1);

    await expect(promise).rejects.toThrow(/handshake timeout/i);
    timedInitializer.dispose();
  });

  it('keeps custom CSS exact, clearable, & generation-fenced', async () => {
    interface ReadRequest {
      resolve: (value: string) => void;
      reject: (error: Error) => void;
    }

    const reads: ReadRequest[] = [];
    vi.spyOn(fs.promises, 'readFile').mockImplementation(
      () =>
        new Promise<string>((resolve, reject) => {
          reads.push({ resolve, reject });
        }) as never
    );
    const createFileSystemWatcher = vi.spyOn(
      vscode.workspace,
      'createFileSystemWatcher'
    );
    const initializer = new PreviewInitializer();
    const watcherManager = new WatcherManager();
    let cssSnapshot = '.configured-a { color: red; }';
    const notifier = {
      setCustomCss: vi.fn((css: string) => {
        cssSnapshot = css;
      }),
    };
    const cssPath = '/workspace/styles/theme[dark]*.css';

    initializer.setupCustomCssWatcher(
      watcherManager,
      cssPath,
      '/workspace',
      notifier
    );
    expect(cssSnapshot).toBe('');
    await vi.waitFor(() => expect(reads).toHaveLength(1));

    const callCountBeforeInitialFailure =
      notifier.setCustomCss.mock.calls.length;
    reads[0].reject(new Error('unreadable replacement'));
    await vi.waitFor(() =>
      expect(notifier.setCustomCss).toHaveBeenCalledTimes(
        callCountBeforeInitialFailure + 1
      )
    );
    expect(cssSnapshot).toBe('');
    notifier.setCustomCss.mockClear();

    const exactPattern = createFileSystemWatcher.mock.calls.at(-1)?.[0];
    expect(exactPattern).toBeInstanceOf(vscode.RelativePattern);
    expect((exactPattern as vscode.RelativePattern).baseUri.fsPath).toBe(
      '/workspace/styles'
    );
    expect((exactPattern as vscode.RelativePattern).pattern).toBe(
      'theme[[]dark[]][*].css'
    );

    const fileWatcher = createFileSystemWatcher.mock.results.at(-1)?.value as {
      fireChange(uri: vscode.Uri): void;
      fireCreate(uri: vscode.Uri): void;
      fireDelete(uri: vscode.Uri): void;
    };
    fileWatcher.fireChange(vscode.Uri.file(cssPath));
    await vi.waitFor(() => expect(reads).toHaveLength(2));
    fileWatcher.fireChange(vscode.Uri.file(cssPath));
    await vi.waitFor(() => expect(reads).toHaveLength(3));

    reads[2].resolve('.latest { color: green; }');
    await vi.waitFor(() =>
      expect(notifier.setCustomCss).toHaveBeenLastCalledWith(
        '.latest { color: green; }'
      )
    );
    reads[1].resolve('.stale { color: red; }');
    await Promise.resolve();
    expect(notifier.setCustomCss).toHaveBeenCalledTimes(1);

    fileWatcher.fireDelete(vscode.Uri.file(cssPath));
    expect(notifier.setCustomCss).toHaveBeenLastCalledWith('');

    fileWatcher.fireCreate(vscode.Uri.file(cssPath));
    await vi.waitFor(() => expect(reads).toHaveLength(4));
    const callCountBeforeReadFailure = notifier.setCustomCss.mock.calls.length;
    reads[3].reject(new Error('unreadable'));
    await vi.waitFor(() =>
      expect(notifier.setCustomCss).toHaveBeenCalledTimes(
        callCountBeforeReadFailure + 1
      )
    );
    expect(notifier.setCustomCss).toHaveBeenLastCalledWith('');

    fileWatcher.fireCreate(vscode.Uri.file(cssPath));
    await vi.waitFor(() => expect(reads).toHaveLength(5));
    reads[4].resolve('.recreated { color: blue; }');
    await vi.waitFor(() =>
      expect(notifier.setCustomCss).toHaveBeenLastCalledWith(
        '.recreated { color: blue; }'
      )
    );

    initializer.setupCustomCssWatcher(
      watcherManager,
      '',
      '/workspace',
      notifier
    );
    expect(notifier.setCustomCss).toHaveBeenLastCalledWith('');
    expect(watcherManager.has('customCss')).toBe(false);
    initializer.dispose();
    watcherManager.dispose();
  });

  it('registers core watchers in createWatchers', () => {
    const initializer = new PreviewInitializer();
    const watcherManager = initializer.createWatchers(
      '/workspace/custom.css',
      vi.fn(async () => undefined),
      Promise.resolve()
    );

    const names = watcherManager.getNames();
    expect(names).toEqual(
      expect.arrayContaining(['document', 'dependency', 'customCss'])
    );
  });

  it('subscribes file previews to valid & unresolved config candidates', async () => {
    const initializer = new PreviewInitializer();
    const watcherManager = new WatcherManager();
    const onConfigChanged = vi.fn();

    initializer.setupConfigWatcher(
      watcherManager,
      'file',
      '/workspace/doc.mdx',
      onConfigChanged
    );

    expect(watcherManager.has('config')).toBe(true);
    expect(configHandlers.length).toBe(1);
    expect(mockWatchConfigCandidates).toHaveBeenCalledWith(
      '/workspace/doc.mdx'
    );

    configHandlers[0]({ configPath: '/workspace/other.json' });
    expect(onConfigChanged).not.toHaveBeenCalled();

    configHandlers[0]({ configPath: '/workspace/.mdx-previewrc.json' });
    expect(onConfigChanged).toHaveBeenCalledTimes(1);

    mockGetConfigCandidatePaths.mockReturnValue([
      '/workspace/docs/.mdx-previewrc.json',
      '/workspace/docs/.mdx-previewrc',
      '/workspace/.mdx-previewrc.json',
      '/workspace/.mdx-previewrc',
    ]);
    const unresolvedWatcherManager = new WatcherManager();
    const onUnresolvedConfigChanged = vi.fn();

    initializer.setupConfigWatcher(
      unresolvedWatcherManager,
      'file',
      '/workspace/docs/doc.mdx',
      onUnresolvedConfigChanged
    );

    configHandlers[1]({
      configPath: '/workspace/other/.mdx-previewrc.json',
    });
    expect(onUnresolvedConfigChanged).not.toHaveBeenCalled();

    configHandlers[1]({
      configPath: '/workspace/docs/.mdx-previewrc.json',
    });
    configHandlers[1]({ configPath: '/workspace/.mdx-previewrc' });
    expect(onUnresolvedConfigChanged).toHaveBeenCalledTimes(2);

    watcherManager.unregister('config');
    unresolvedWatcherManager.unregister('config');
    expect(configCandidateDisposables[0].dispose).toHaveBeenCalledTimes(1);
    expect(configCandidateDisposables[1].dispose).toHaveBeenCalledTimes(1);

    const typescriptWatcherManager = new WatcherManager();
    const onTypeScriptConfigChanged = vi.fn();

    initializer.setupTypeScriptConfigWatcher(
      typescriptWatcherManager,
      'file',
      '/workspace/a/doc.mdx',
      onTypeScriptConfigChanged
    );

    expect(mockWatchTypeScriptConfig).toHaveBeenCalledWith(
      '/workspace/a/doc.mdx',
      expect.any(Function)
    );
    typescriptConfigHandlers[0]('/workspace/a/tsconfig.json');
    expect(onTypeScriptConfigChanged).toHaveBeenCalledTimes(1);

    const refreshOrder: string[] = [];
    const previewWatcherManager = new WatcherManager();
    const handleTypeScriptConfigChange = (
      Preview.prototype as unknown as {
        handleTypeScriptConfigChange(this: {
          clearAllCaches(): Promise<void>;
          documentHandler: {
            reloadTypescriptConfig(manager: WatcherManager): void;
          };
          updateWebview(force: boolean): Promise<void>;
          watcherManager: WatcherManager;
        }): Promise<void>;
      }
    ).handleTypeScriptConfigChange;
    const previewHarness = {
      initializer,
      watcherManager: previewWatcherManager,
      doc: { uri: vscode.Uri.file('/workspace/c/doc.mdx') },
      documentHandler: {
        reloadTypescriptConfig: () => refreshOrder.push('reload'),
      },
      clearAllCaches: vi.fn(async () => {
        refreshOrder.push('clear');
      }),
      updateWebview: vi.fn(async (force: boolean) => {
        refreshOrder.push(`update:${force}`);
      }),
      handleTypeScriptConfigChange,
    };
    const setupTypeScriptConfigWatcher = (
      Preview.prototype as unknown as {
        setupTypeScriptConfigWatcher(this: typeof previewHarness): void;
      }
    ).setupTypeScriptConfigWatcher;
    setupTypeScriptConfigWatcher.call(previewHarness);
    typescriptConfigHandlers.at(-1)?.('/workspace/c/tsconfig.json');

    await vi.waitFor(() => {
      expect(refreshOrder).toEqual(['reload', 'clear', 'update:true']);
    });

    previewHarness.clearAllCaches.mockRejectedValueOnce(
      new Error('cache RPC rejected')
    );
    previewHarness.updateWebview.mockClear();
    typescriptConfigHandlers.at(-1)?.('/workspace/c/tsconfig.json');
    await vi.waitFor(() => {
      expect(previewHarness.clearAllCaches).toHaveBeenCalledTimes(2);
    });
    expect(previewHarness.updateWebview).not.toHaveBeenCalled();

    initializer.setupTypeScriptConfigWatcher(
      typescriptWatcherManager,
      'file',
      '/workspace/b/doc.mdx',
      onTypeScriptConfigChanged
    );

    expect(typescriptConfigDisposables[0].dispose).toHaveBeenCalledTimes(1);
    expect(mockWatchTypeScriptConfig).toHaveBeenLastCalledWith(
      '/workspace/b/doc.mdx',
      expect.any(Function)
    );

    typescriptWatcherManager.dispose();
    expect(typescriptConfigDisposables[2].dispose).toHaveBeenCalledTimes(1);
    previewWatcherManager.dispose();
    expect(typescriptConfigDisposables[1].dispose).toHaveBeenCalledTimes(1);

    const dispose = vi.fn();
    let detectionChange: ((changedPaths: string[]) => void) | undefined;
    mockTailwindProcessor.onDidChangeDetectionInputs.mockImplementation(
      (_workspaceRoot, callback) => {
        detectionChange = callback;
        return { dispose };
      }
    );
    const tailwindWatcherManager = new WatcherManager();
    const onChange = vi.fn();

    initializer.setupTailwindDetectionWatcher(
      tailwindWatcherManager,
      'file',
      '/workspace',
      onChange,
      (changedPath) => changedPath === '/workspace/tailwind.config.ts'
    );
    detectionChange?.(['/workspace/tailwind.config.ts']);

    expect(
      mockTailwindProcessor.onDidChangeDetectionInputs
    ).toHaveBeenCalledWith('/workspace', expect.any(Function));
    expect(mockTailwindProcessor.invalidateVersionCache).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();

    detectionChange?.([
      '/workspace/tailwind.config.ts',
      '/workspace/styles/app.css',
    ]);

    expect(mockTailwindProcessor.invalidateVersionCache).toHaveBeenCalledWith(
      '/workspace'
    );
    expect(onChange).toHaveBeenCalledWith(['/workspace/styles/app.css']);

    tailwindWatcherManager.unregister('tailwindDetection');
    expect(dispose).toHaveBeenCalledTimes(1);

    const createFileSystemWatcher = vi.spyOn(
      vscode.workspace,
      'createFileSystemWatcher'
    );
    const exactWatcherManager = new WatcherManager();
    const watchDir = path.join(
      path.parse(process.cwd()).root,
      'workspace',
      'site[one]',
      'styles'
    );
    const watchedPath = path.join(watchDir, 'tailwind*?{draft}[v4].css');

    initializer.setupTailwindConfigWatcher(
      exactWatcherManager,
      [watchedPath],
      vi.fn()
    );

    const exactPattern = createFileSystemWatcher.mock.calls.at(-1)?.[0];
    expect(exactPattern).toBeInstanceOf(vscode.RelativePattern);
    expect((exactPattern as vscode.RelativePattern).baseUri.fsPath).toBe(
      watchDir
    );
    expect((exactPattern as vscode.RelativePattern).pattern).toBe(
      'tailwind[*][?][{]draft[}][[]v4[]].css'
    );

    exactWatcherManager.unregister('tailwind');
  });
});
