// tests/extension/preview/PreviewInitializer.test.ts
// unit tests for preview initialization & watcher orchestration

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as vscode from 'vscode';
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
    onTypeScriptConfigChange: (handler: (configPath: string) => void) => {
      typescriptConfigHandlers.push(handler);
      return { dispose: vi.fn() };
    },
  })
);

describe('PreviewInitializer', () => {
  beforeEach(() => {
    configHandlers.length = 0;
    configCandidateDisposables.length = 0;
    typescriptConfigHandlers.length = 0;
    mockGetConfigCandidatePaths.mockReturnValue([
      '/workspace/.mdx-previewrc.json',
      '/workspace/.mdx-previewrc',
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves handshake when resolve is called', async () => {
    const initializer = new PreviewInitializer();
    const { promise, resolve } = initializer.createHandshake();

    resolve();

    await expect(promise).resolves.toBeUndefined();
  });

  it('rejects handshake after timeout', async () => {
    vi.useFakeTimers();
    const initializer = new PreviewInitializer();
    const { promise } = initializer.createHandshake();

    vi.advanceTimersByTime(WEBVIEW_HANDSHAKE_TIMEOUT_MS + 1);

    await expect(promise).rejects.toThrow(/handshake timeout/i);
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

  it('subscribes file previews to valid & unresolved config candidates', () => {
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
